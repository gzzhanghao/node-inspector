'use strict';

const co = require('co');
const scriptPrefix = '(function (exports, require, module, __filename, __dirname) { ';
const scriptPostfix = '\n});'
const fs = require('fs');
const promisify = require('bluebird').promisify;
const writeFile = promisify(fs.writeFile);

const ScriptHelper = module.exports = {

  resolveScriptById(context, id) {
    return co(function * () {
      const script = context.backend.scriptManager.resolveScriptById(id);
      if (script) {
        return script;
      }
      const scripts = yield context.session.request('scripts', {
        includeSource: false,
        filter: id
      });
      if (scripts.length) {
        return this.addScript(scripts[0]);
      }
    });
  },

  resolveScriptByUrl(context, url) {
    return context.backend.scriptManager.resolveScriptByUrl(url);
  },

  getScriptSource(context, id) {
    return co(function * () {
      const session = context.session;
      const scripts = yield session.request('scripts', { ids: [id], includeSource: true, types: 4, });
      if (!scripts.length) {
        throw new Error(`Cannot get source of script ${id}`);
      }
      return scripts[0].source;
    });
  },

  setScriptSource(context, scriptId, newSource, previewOnly) {
    return co(function * () {
      const session = context.session;

      if (!newSource.startsWith(scriptPrefix) || !newSource.endsWith(scriptPostfix)) {
        throw new Error('New source is not a node.js script');
      }

      const response = yield context.session.request('changeLive', {
        script_id: scriptId,
        new_source: newSource,
        preview_only: previewOnly
      });

      if (!previewOnly) {
        const script = yield ScriptHelper.resolveScriptById(context, scriptId);
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
