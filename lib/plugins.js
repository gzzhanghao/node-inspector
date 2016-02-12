'use strict';

var fs = require('fs'),
    inherits = require('util').inherits,
    path = require('path');

var THROW_CONFLICTS = true;

function getPluginPath(config) {
  return (config && config.pluginPath) || path.join(__dirname, '../plugins');
}

function PluginError(message) {
  this.name = 'Plugin Error';
  this.message = this.name + ':\n' + message;
}
inherits(PluginError, Error);

function findEq(collection, option, value) {
  return collection.filter(function(item) {
    return item[option] == value;
  })[0];
}

function mergeByName(acceptor, donor, name, onConflict) {
  if (!donor || !donor.length) return;

  donor.forEach(function(note) {
    var sameOrigNote = findEq(acceptor, name, note[name]);
    if (sameOrigNote) {
      onConflict(sameOrigNote, note);
    } else {
      acceptor.push(note);
    }
  }, this);
}

var cachedPlugins = {};

function _setMockPlugins(pluginPath, plugins) {
  cachedPlugins[pluginPath] = plugins;
}

function getPlugins(config) {
  if (!config || !config.plugins) {
    return [];
  }

  var pluginPath = getPluginPath(config);
  if (cachedPlugins[pluginPath])  {
    return cachedPlugins[pluginPath];
  }

  var dirlist;

  try {
    dirlist = fs.readdirSync(pluginPath);
  } catch (err) {
    dirlist = [];
  }

  var plugins = [];

  dirlist.reduce(function(plugins, subdir) {
    var _path = path.resolve(pluginPath, subdir, 'manifest.json');
    var manifest;

    try {
      manifest = require(_path);

      // This excludes situation where we have two plugins with same name.
      if (subdir !== manifest.name)
        throw new PluginError('Plugin name in manifest.json is different from npm module name');
    } catch (e) {
      console.error('Corrupted manifest.json in %s plugin\n%s\n%s', subdir, e.message, e.stack);
      return plugins;
    }

    validateManifest(manifest);
    plugins.push(manifest);
    return plugins;
  }, plugins);

  cachedPlugins[pluginPath] = plugins;
  return plugins;
}

function validateManifest(manifest) {
  manifest.session = manifest.session || {};
  manifest.protocol = manifest.protocol || {};
  manifest.protocol.domains = manifest.protocol.domains || [];
}

function InspectorJson(config) {
  const inspectorJson = require('../front-end/inspector.json');
  const extendedInspectorJson = require('../front-end-node/inspector.json');

  this._config = config;

  this._notes = inspectorJson;
  this._merge(extendedInspectorJson);

  if (!config.plugins) return;

  for (let plugin of getPlugins(config)) {
    const excludes = (plugin.excludes || []).map(name => ({ name, type: 'exclude' }));
    const overrides = plugin.override || [];
    const note = { name: `plugins/${plugin.name}`, type: plugin.type || '' };
    const notes = excludes.concat(overrides).concat(note);
    this._merge(notes);
  }
}

InspectorJson.prototype._merge = function(toMergeNotes) {
  const result = [];

  for (let note of toMergeNotes) {
    if (note.type !== 'exclude') {
      result.push(note);
    }
  }

  for (let note of this._notes) {
    if (!findEq(toMergeNotes, 'name', note.name)) {
      result.push(note);
    }
  }

  this._notes = result;
};

InspectorJson.prototype.toJSON = function() {
  return this._notes;
};


function ProtocolJson(config) {
  const protocolJson = require('../tools/protocol.json');
  const extendedProtocolJson = require('../front-end-node/protocol.json');

  this._config = config;
  this._protocol = protocolJson;
  this._domains = protocolJson.domains;
  this._extendedDomains = extendedProtocolJson.domains;

  if (config.plugins) {
    // At first step we merge all plugins in one protocol.
    // We expect what plugins doesn't have equal methods, events or types,
    // otherwise we throw an error, because this is unsolvable situation.
    for (let plugin of getPlugins(config)) {
      this._merge(THROW_CONFLICTS, plugin.name, this._extendedDomains, plugin.protocol.domains);
    }
  }

  // At second step we merge plugins with main protocol.
  // Plugins can override original methods, events or types,
  // so we don't need to throw error on conflict, we only print a warning to console.
  this._merge(!THROW_CONFLICTS, '', this._domains, this._extendedDomains);
}

ProtocolJson.prototype._merge = function(throwConflicts, pluginName, origDomains, toMergeDomains) {
  if (!toMergeDomains.length) return;

  const uniqueName = 'domain';
  const state = {
    throwConflicts: throwConflicts,
    plugin: pluginName
  };

  mergeByName(
    origDomains,
    toMergeDomains,
    uniqueName,
    this._onDomainConflict.bind(this, state));
};

ProtocolJson.prototype._onDomainConflict = function(state, origDomain, toMergeDomain) {
  state.domain = toMergeDomain.domain;

  ['commands', 'events', 'types'].forEach(function(section) {
    // TODO(3y3): types are unique for protocol, not for domain.
    // We need to register types cache and search in it for conflicts.
    var uniqueName = section == 'types' ? 'id' : 'name',
        origSection = origDomain[section],
        toMergeSection = toMergeDomain[section];

    if (!toMergeSection || !toMergeSection.length)
      return;

    if (!origSection || !origSection.length) {
      origDomain[section] = toMergeSection;
      return;
    }

    state.section = section;
    state.uname = uniqueName;

    mergeByName(
      origSection,
      toMergeSection,
      uniqueName,
      this._onItemConflict.bind(this, state));
  }, this);
};

ProtocolJson.prototype._onItemConflict = function(state, origItem, toMergeItem) {
  if (state.throwConflicts) {
    throw new PluginError(
      'Unresolved conflict in ' + state.section + ' section of `' + state.plugin + '` plugin: ' +
      'item with ' + state.uname + ' `' + toMergeItem[state.uname] + '` already exists.');
  } else {
    console.warn(
      'Item with ' + state.uname + ' `' + toMergeItem[state.uname] + '`' +
      ' in ' + state.section + ' section' +
      ' of ' + state.domain + ' domain' +
      ' was owerriden.');
  }
};

ProtocolJson.prototype.toJSON = function() {
  return this._protocol;
};

function init(config) {
  module.exports.CWD = getPluginPath(config);
}

module.exports = {
  _setMockPlugins: _setMockPlugins,
  getPluginPath: getPluginPath,
  getPlugins: getPlugins,
  validateManifest: validateManifest,
  PluginError: PluginError,
  InspectorJson: InspectorJson,
  ProtocolJson: ProtocolJson,
  init: init
};
