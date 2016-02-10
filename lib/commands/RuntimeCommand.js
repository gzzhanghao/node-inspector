'use strict';

const co = require('co');

exports.Runtime = {

  enable(context, msg) {
    return context.session.send({
      method: 'Runtime.executionContextCreated',
      params: {
        context: {
          id: 1,
          isPageContext: true,
          name: '<top frame>',
          origin: '<top frame>',
          frameId: 'ni-top-frame'
        }
      }
    });
  }
};
