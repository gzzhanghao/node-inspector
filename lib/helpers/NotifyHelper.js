'use strict';

const format = require('util').format;

module.exports = {

  name: 'NodeInspector.NotifyHelper',

  inject(backend) {

    /**
     * Send a log message to frontends
     */
    return function(level/*, ...msg*/) {
      backend.emitEvent({
        method: 'Console.messageAdded',
        params: {
          message: {
            level,
            text: format.apply(null, [].slice.call(arguments, 1)),
            url: '', source: 3, type: 0,
            line: 0, column: 0, groupLevel: 7,
            repeatCount: 1
          }
        }
      })
    };
  }
};
