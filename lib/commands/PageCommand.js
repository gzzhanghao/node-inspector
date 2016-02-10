'use strict';

const co = require('co');
const ScriptHelper = require('../helpers/ScriptHelper');

exports.Page = {

  getResourceTree(context, params) {
    return co(function * () {
      const backend = context.backend;
      yield backend.ready;
      const env = backend.environment;

      return {
        frameTree: {
          frame: {
            id: 'ni-top-frame',
            name: '<top frame>',
            url: env.filename,
            securityOrigin: 'node-inspector',
            loaderId: env.pid,
            mimeType: 'text/javascript'
          },
          resources: backend.scriptManager.resources
        }
      };
    });
  },

  getResourceContent(context, params) {
    return co(function * () {
      const script = yield ScriptHelper.resolveScriptByUrl(context, params.url);
      return { content: yield ScriptHelper.getScriptSource(context, script.scriptId) };
    });
  }
};
