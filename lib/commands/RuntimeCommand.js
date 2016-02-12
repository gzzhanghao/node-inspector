'use strict';

const co = require('co');

module.exports = function(backend) {
  
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
};
