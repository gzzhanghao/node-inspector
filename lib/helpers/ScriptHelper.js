'use strict';

const co = require('co');
const fs = require('fs');
const path = require('path');
const promisify = require('bluebird').promisify;

const writeFile = promisify(fs.writeFile);

const scriptPrefix = '(function (exports, require, module, __filename, __dirname) { ';
const scriptPostfix = '\n});';

module.exports = function(backend) {

  const convert = backend.convert;

  const helper = backend.scripts = {

    resources: [],

    addScript(script) {
      if (helper.resources.find(s => s.scriptId === script.id)) {
        return null;
      }

      const data = convert.script(script);

      helper.resources.push(data);
      backend.emitEvent('Debugger.scriptParsed', data);
    },

    resync() {
      return co(function * () {
        helper.resources = [];

        const scripts = yield backend.request('scripts', {
          types: 4,
          includeSource: true
        });

        scripts.forEach(script => helper.addScript(script));
      });
    },

    resolveScriptById(id) {
      return co(function * () {
        const script = helper.resources.find(s => s.scriptId === id);
        if (script) {
          return script;
        }
        const scripts = yield backend.request('scripts', {
          includeSource: false,
          filter: id
        });
        if (!scripts.length) {
          throw new Error(`Cannot get script with id ${id}`);
        }
        return helper.addScript(scripts[0]);
      });
    },

    resolveScriptByUrl(url) {
      return helper.resources.find(s => s.name === url);
    },

    getScriptSource(id) {
      return co(function * () {
        const scripts = yield backend.request('scripts', {
          includeSource: true,
          filter: id
        });
        if (!scripts.length) {
          throw new Error(`Cannot get source of script ${id}`);
        }
        return scripts[0].source;
      });
    },

    setScriptSource(scriptId, newSource, previewOnly) {
      return co(function * () {
        if (!newSource.startsWith(scriptPrefix) || !newSource.endsWith(scriptPostfix)) {
          throw new Error('New source is not a node.js script');
        }

        const response = yield backend.request('changeLive', {
          script_id: scriptId,
          new_source: newSource,
          preview_only: previewOnly
        });

        if (backend.config.saveLiveEdit && !previewOnly) {
          const script = yield helper.resolveScriptById(scriptId);
          if (!script) {
            throw new Error(`unknown script id ${scriptId}`);
          }
          if (script.internal) {
            throw new Error('Cannot set content of internal script');
          }
          yield writeFile(script.name, newSource.slice(scriptPrefix.length, -scriptPostfix.length));
        }

        return response.result;
      });
    }
  };
};
