'use strict';

const co = require('co');
const fs = require('mz/fs');
const Path = require('path');

const scriptPrefix = '(function (exports, require, module, __filepath, __dirpath) { ';
const scriptPostfix = '\n});';

module.exports = {

  name: 'NodeInspector.ScriptHelper',

  inject: co.wrap(function * (backend) {

    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');

    const Script = {

      /**
       * @type {Array<InspectorScript>}
       */
      resources: [],

      /**
       * @type {Object}
       */
      sources: Object.create(null),

      /**
       * @param {V8Script} v8 script object
       * @return {InspectorScript}
       */
      add(v8Script) {
        const scriptId = v8Script.id + '';

        const exists = this.get(scriptId);
        if (exists) return exists;

        const path = v8Script.name || '';
        const url = this.path2url(path);

        // @todo sourceMapURL
        const script = {
          url, path, scriptId,
          startLine: v8Script.lineOffset,
          startColumn: v8Script.columnOffset
        };

        this.resources.push(script);
        this.sources[scriptId] = Promise.resolve(
          v8Script.source || this.source(scriptId)
        );

        return script;
      },

      /**
       * Get script with script id
       *
       * @param {string} id
       * @return {Promise<InspectorScript>}
       */
      get(id) {
        return this.resources.find(s => s.scriptId == id);
      },

      /**
       * Get script with script url
       *
       * @param {string} url
       * @return {Promise<InspectorScript>}
       */
      find(url) {
        return this.resources.find(s => s.url === url);
      },

      /**
       * Get source of script
       *
       * @param {string} scriptId
       *
       * @return {Promise<string>}
       */
      source(scriptId) {
        if (!this.sources[scriptId]) {
          this.sources[scriptId] = co(function * () {
            const scripts = yield backend.request('scripts', {
              filter: scriptId,
              includeSource: true
            });
            return scripts[0].source;
          }.bind(this));
        }
        return this.sources[scriptId];
      },

      /**
       * Set script content
       *
       * @param {number} scriptId
       * @param {string} source
       * @param {boolean} preview
       *
       * @return {Object} Result of `changeLive` request
       */
      set(scriptId, source, preview) {
        return co(function * () {
          if (!source.startsWith(scriptPrefix) ||
              !source.endsWith(scriptPostfix)) {
            throw new Error('New source is not a node.js script');
          }

          const scripts = yield backend.request('scripts', {
            filter: scriptId
          });

          const response = yield backend.request('changeLive', {
            script_id: scriptId,
            new_source: source,
            preview_only: preview
          });

          if (backend.config.saveLiveEdit && !preview) {

            const script = yield this.get(scriptId);

            if (this.isInternal(script.path)) {
              throw new Error('Cannot edit internal script');
            }

            // @todo shebang
            yield fs.writeFile(
              script.path,
              source.slice(scriptPrefix.length, -scriptPostfix.length)
            );
          }

          return response.result;
        }.bind(this));
      },

      /**
       * Check if script is internal
       *
       * @param {string} path
       *
       * @return {boolean} whether the script is internal
       */
      isInternal: path => !Path.isAbsolute(path),

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
        if (url.startsWith('file://')) {
          return url.slice('file://'.length);
        }
        return '';
      },

      /**
       * Convert path path to url
       *
       * @param {string} path
       *
       * @return {string} url
       */
      path2url(path_) {
        if (!path_) return '';
        const path = path_.replace(/\\/g, '/');
        if (this.isInternal(path)) {
          return 'node:///' + path;
        }
        return 'file://' + path;
      },

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
      }
    };

    protocol.registerEvents({
      afterCompile(msg) {
        return {
          method: 'Debugger.scriptParsed',
          params: Script.add(msg.script)
        };
      }
    });

    backend.on('frontend', frontend => {
      Script.resources.forEach(script => {
        frontend.emitEvent('Debugger.scriptParsed', script);
      });
    });

    return Script;
  })
};
