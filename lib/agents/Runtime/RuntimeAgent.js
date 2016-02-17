'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.RuntimeAgent',

  inject: co.wrap(function * (backend) {

    const inject = yield backend.plugin('NodeInspector.InjectorAgent');
    const protocolHelper = yield backend.plugin('NodeInspector.ProtocolHelper');

    protocolHelper.registerCommands({
      'Runtime.enable'(msg) {
        return backend.emitEvent('Runtime.executionContextCreated', {
          context: {
            id: 1,
            isPageContext: true,
            name: '<top frame>',
            origin: '<top frame>',
            frameId: 'ni-top-frame'
          }
        });
      }
    });

    yield inject(require.resolve('./RuntimeInjection'));
  })
};
