'use strict';

const co = require('co');

module.exports = function(backend) {

  const scripts = backend.scripts;

  const createFrame = (type, url, loaderId) => ({
    url,
    loaderId,
    id: `ni-${type}-frame`,
    name: `<${type} frame>`,
    securityOrigin: 'node-inspector',
    mimeType: 'text/javascript'
  });

  backend.registerCommands({

    'Page.getResourceTree': () => co(function * () {
      const env = yield backend.environment();
      if (!scripts.initialized) yield scripts.reload();
      return {
        frameTree: {
          frame: createFrame('top', scripts.path2url(env.filename), env.pid),
          resources: [],
          childFrames: [{
            frame: createFrame('script', scripts.path2url(env.filename), env.pid),
            resources: scripts.resources
          }, {
            frame: createFrame('native', 'node://', env.pid),
            resources: scripts.resources
          }]
        }
      };
    }),

    'Page.getResourceContent': params => co(function * () {
      const script = scripts.getScriptByUrl(params.url);
      return { content: yield scripts.getScriptSource(script.scriptId) };
    })
  });
};
