'use strict';

const co = require('co');
const flatten = require('../util').flatten;

module.exports = function(backend) {

  const scripts = backend.scripts;
  const convert = backend.convert;

  backend.registerCommands(flatten({

    Page: {

      getResourceTree() {
        return co(function * () {
          const env = yield backend.environment();

          yield scripts.reload();

          return {
            frameTree: {
              frame: {
                id: 'ni-top-frame',
                name: '<top frame>',
                url: convert.path2url(env.filename),
                securityOrigin: 'node-inspector',
                loaderId: env.pid,
                mimeType: 'text/javascript'
              },
              childFrames: [{
                frame: {
                  id: 'ni-script-frame',
                  name: '<script frame>',
                  url: convert.path2url(env.filename),
                  securityOrigin: 'node-inspector',
                  loaderId: env.pid,
                  mimeType: 'text/javascript'
                },
                resources: scripts.resources
              }, {
                frame: {
                  id: 'ni-native-frame',
                  name: '<native frame>',
                  url: 'node:///',
                  securityOrigin: 'node-inspector',
                  loaderId: env.pid,
                  mimeType: 'text/javascript'
                },
                resources: scripts.resources
              }]
            }
          };
        });
      },

      getResourceContent(params) {
        return co(function * () {
          const script = scripts.getScriptByUrl(params.url);
          return { content: yield scripts.getScriptSource(script.scriptId) };
        });
      }
    }
  }));
};
