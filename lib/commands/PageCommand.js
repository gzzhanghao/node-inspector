'use strict';

const co = require('co');
const flatten = require('../util').flatten;

module.exports = function(backend) {

  const scripts = backend.scripts;

  backend.registerCommands(flatten({

    Page: {

      getResourceTree() {
        return co(function * () {
          yield backend.ready;

          const env = yield backend.environment();

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
              resources: scripts.resources.filter(s => !s.internal)
            }
          };
        });
      },

      getResourceContent(params) {
        return co(function * () {
          const script = scripts.resolveScriptByUrl(params.url);
          return { content: yield scripts.getScriptSource(script.scriptId) };
        });
      }
    }
  }));
};
