'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.RuntimeAgent',

  inject: co.wrap(function * (backend) {

    // @depend registerCommands
    yield backend.plugin('NodeInspector.ProtocolHelper');

    // @depend inject
    yield backend.plugin('NodeInspector.InjectorAgent');

    backend.registerCommands({
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

    return backend.inject(require.resolve('./RuntimeInjection'));
  })
};
