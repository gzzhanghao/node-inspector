'use strict';

const co = require('co');

module.exports = function(session) {
  
  session.registerCommands({
    'Runtime.enable'(msg) {
      return session.send('Runtime.executionContextCreated', {
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
