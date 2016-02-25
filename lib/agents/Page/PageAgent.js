'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.PageAgent',

  inject: co.wrap(function * (backend) {

    const env = yield backend.plugin('NodeInspector.EnvironmentHelper');
    const Script = yield backend.plugin('NodeInspector.ScriptHelper');
    const protocolHelper = yield backend.plugin('NodeInspector.ProtocolHelper');

    const createFrame = (type, url, loaderId) => ({
      url,
      loaderId: env.pid,
      id: `ni-${type}-frame`,
      name: `<${type} frame>`,
      securityOrigin: 'node-inspector',
      mimeType: 'text/javascript'
    });

    protocolHelper.registerCommands({

      'Page.getResourceTree': () => co(function * () {
        yield Script.reload();
        return {
          frameTree: {
            frame: createFrame('top', Script.path2url(env.filename)),
            resources: Script.getFiles().map(s => ({
              url: s.url,
              type: 'Script',
              mimeType: 'text/javascript'
            }))
          }
        };
      }),

      'Page.getResourceContent': params => co(function * () {
        const script = Script.find(params.url);
        return { content: yield Script.source(script.scriptId) };
      })
    });
  })
};
