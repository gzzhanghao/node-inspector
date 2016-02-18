const co = require('co');

module.exports = {

  name: 'NodeInspector.ConsoleAgent',

  inject: co.wrap(function * (backend) {

    const inject = yield backend.plugin('NodeInspector.InjectorAgent');
    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');
    const scriptHelper = yield backend.plugin('NodeInspector.ScriptHelper');

    protocol.registerEvents({
      'Console.messageAdded': params => {
        params.message.url = scriptHelper.path2url(params.message.url);
        return { method: 'Console.messageAdded', params };
      }
    });

    yield inject(require.resolve('./ConsoleInjection'));
  })
};
