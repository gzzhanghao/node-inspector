'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.PageAgent',

  inject: co.wrap(function * (backend) {

    const env = yield backend.plugin('NodeInspector.EnvironmentHelper');
    const Script = yield backend.plugin('NodeInspector.ScriptHelper');
    const protocolHelper = yield backend.plugin('NodeInspector.ProtocolHelper');

    protocolHelper.registerCommands({

      'Page.getResourceTree': co.wrap(function * () {
        // @todo preload
        return {
          frameTree: {
            frame: {
              loaderId: env.pid,
              id: `ni-top-frame`,
              name: `<top frame>`,
              url: Script.path2url(env.filename),
              securityOrigin: 'node-inspector',
              mimeType: 'text/javascript'
            },
            resources: []
          }
        };
      }),

      'Page.getResourceContent': co.wrap(function * (params) {
        const script = Script.find(params.url);
        return { content: yield Script.source(script.scriptId) };
      })
    });
  })
};
