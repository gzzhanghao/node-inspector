'use strict';

const co = require('co');
const flatten = require('../util').flatten;

module.exports = function(session) {

  const backend = session.backend;
  const scripts = backend.scripts;

  session.registerCommands(flatten({

    Page: {

      getResourceTree() {
        return co(function * () {
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
