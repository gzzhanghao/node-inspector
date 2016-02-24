'use strict';

const co = require('co');
const fs = require('mz/fs');
const path = require('path');

const scriptPrefix = '(function (exports, require, module, __filename, __dirname) { ';
const scriptPostfix = '\n});';

module.exports = {

  name: 'NodeInspector.ScriptHelper',

  inject: co.wrap(function * (backend) {

    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');

    const helper = {

      /**
       * @type {Array<InspectorScript>}
       */
      resources: [],

      /**
       * @param {V8Script} v8 script object
       * @return {InspectorScript}
       */
      add(v8Script) {
        if (this.resources.find(s => s.scriptId == v8Script.id)) return;

        const name = this.scriptName(v8Script.name);
        const internal = this.scriptIsInternal(name);

        const script = {
          name, internal,
          scriptId: String(v8Script.id),
          url: this.path2url(name),
          startLine: v8Script.lineOffset,
          startColumn: v8Script.columnOffset
        };

        this.resources.push(script);

        // @todo move this to other layer
        backend.emitEvent('Debugger.scriptParsed', script);

        return script;
      },

      /**
       * Reload script list
       */
      reload() {
        return co(function * () {
          const scripts = yield backend.request('scripts', { types: 4 });

          // this.resources = [];
          scripts.forEach(script => this.add(script));
        }.bind(this));
      },

      /**
       * Get script with script id
       *
       * @param {string} id
       * @return {Promise<InspectorScript>}
       */
      getScriptById(id) {
        return co(function * () {
          const script = this.resources.find(s => s.scriptId == id);
          if (script) return script;

          const scripts = yield backend.request('scripts', { filter: id });
          if (!scripts.length) {
            throw new Error(`Cannot get script with id ${id}`);
          }

          return this.add(scripts[0]);
        }.bind(this));
      },

      /**
       * Get script with script url
       *
       * @param {string} url
       * @return {Promise<InspectorScript>}
       */
      getScriptByUrl(url) {
        const script = this.resources.find(s => s.url === url);
        if (script) return script;
        throw new Error(`Cannot get script with url ${url}`);
      },

      /**
       * Get script content by id
       *
       * @param {number} id
       * @return {Promise<InspectorScript>}
       */
      getScriptSource(id) {
        return co(function * () {
          const scripts = yield backend.request('scripts', {
            includeSource: true,
            filter: id
          });
          if (!scripts.length) {
            const script = yield this.getScriptById(id);
            const content = yield fs.readFile(script.name, 'utf-8');
            return scriptPrefix + content + scriptPostfix;
          }
          return scripts[0].source;
        }.bind(this));
      },

      /**
       * Set script content
       *
       * @param {number} id
       * @param {string} source
       * @param {boolean} preview
       * @return {Object} Result of `changeLive` request
       */
      setScriptSource(id, source, preview) {
        return co(function * () {
          if (!source.startsWith(scriptPrefix) ||
              !source.endsWith(scriptPostfix)) {
            throw new Error('New source is not a node.js script');
          }

          const scripts = yield backend.request('scripts', { filter: id });
          const response = yield backend.request('changeLive', {
            script_id: id,
            new_source: source,
            preview_only: preview
          });

          if (backend.config.saveLiveEdit && !preview) {
            const script = yield this.getScriptById(id);
            if (script.internal) {
              throw new Error('Cannot set content of internal script');
            }
            yield fs.writeFile(
              script.name,
              source.slice(scriptPrefix.length, -scriptPostfix.length)
            );
          }

          return response.result;
        }.bind(this));
      },

      /**
       * Normalize script name
       *
       * @param {string} name
       *
       * @return {string} normalized name
       */
      scriptName: name => (name || '').replace(/\\/g, '/'),

      /**
       * Check if script is internal
       *
       * @param {string} name
       *
       * @return {boolean} whether the script is internal
       */
      scriptIsInternal: name => !path.isAbsolute(name),

      /**
       * Convert v8 style location to inspector location
       *
       * @param {V8Location} loc
       *
       * @return {InspectorLocation}
       */
      location(loc) {
        return {
          scriptId: loc.script_id.toString(),
          lineNumber: loc.line,
          columnNumber: loc.column
        };
      },

      /**
       * Convert script url to path
       *
       * @param {string} url
       *
       * @return {string} path
       */
      url2path(url) {
        if (url.startsWith('node:///')) {
          return url.slice('node:///'.length);
        }
        return url.slice('file://'.length);
      },

      /**
       * Convert path name to url
       *
       * @param {string} path
       *
       * @return {string} url
       */
      path2url(path) {
        const name = this.scriptName(path);
        if (!this.scriptIsInternal(name)) {
          return 'file://' + name;
        }
        return 'node:///' + name;
      }
    };

    protocol.registerEvents({
      afterCompile(msg) {
        helper.add(msg.script);
      }
    });

    return helper;
  })
};
