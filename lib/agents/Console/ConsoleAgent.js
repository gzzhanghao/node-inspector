const co = require('co');

module.exports = {

  name: 'NodeInspector.ConsoleAgent',

  inject: co.wrap(function * (backend) {

    const inject = yield backend.plugin('NodeInspector.InjectorAgent');
    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');
    const scriptHelper = yield backend.plugin('NodeInspector.ScriptHelper');

    yield inject(require.resolve('./ConsoleInjection'));

    protocol.registerEvents({

      'Console.messageAdded'(params, orig) {
        params.message.url = scriptHelper.path2url(params.message.url);
        return orig(params).then(msg => {
          if (msg) backend.messages.push(msg);
          return msg;
        });
      },

      'Console.messagesCleared'(params, orig) {
        backend.messages = [];
        return orig(params);
      }
    });
  })
};
