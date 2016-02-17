'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.PageAgent',

  inject: co.wrap(function * (backend) {

    // @depend ScriptHelper
    const scriptHelper = yield backend.plugin('NodeInspector.ScriptHelper');

    // @depend environment
    yield backend.plugin('NodeInspector.EnvironmentHelper');

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
        const env = yield backend.environment;
        yield scriptHelper.reload();
        return {
          frameTree: {
            frame: createFrame('top', scriptHelper.path2url(env.filename), env.pid),
            resources: [],
            childFrames: [{
              frame: createFrame('script', scriptHelper.path2url(env.filename), env.pid),
              resources: scriptHelper.resources
            }, {
              frame: createFrame('native', 'node://', env.pid),
              resources: scriptHelper.resources
            }]
          }
        };
      }),

      'Page.getResourceContent': params => co(function * () {
        const script = scriptHelper.getScriptByUrl(params.url);
        return { content: yield scriptHelper.getscriptHelperource(script.scriptId) };
      })
    });
  })
};
