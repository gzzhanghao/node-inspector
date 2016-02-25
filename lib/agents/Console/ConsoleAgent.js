const co = require('co');

module.exports = {

  name: 'NodeInspector.ConsoleAgent',

  inject: co.wrap(function * (backend) {

    const inject = yield backend.plugin('NodeInspector.InspectorAgent');
    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');
    const Script = yield backend.plugin('NodeInspector.ScriptHelper');

    yield inject(require.resolve('./ConsoleInjection'));

    protocol.registerEvents({

      'Console.messageAdded'(params, orig) {
        const url = params.message.url;
        if (!url.startsWith('eval at') && url !== 'backend') {
          params.message.url = Script.path2url(url);
        }
        return orig(params);
      }
    });
  })
};
