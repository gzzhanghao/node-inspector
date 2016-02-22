'use strict';

const format = require('util').format;

module.exports = {

  name: 'NodeInspector.NotifyHelper',

  inject(backend) {

    /**
     * Send a log message to frontends
     */
    function notify(level/*, ...msg*/) {
      return backend.emitEvent('Console.messageAdded', {
        message: {
          level,
          url: 'backend', line: 0, column: 0,
          repeatCount: 0,
          timestamp: Date.now(),
          parameters: [].slice.call(arguments, 1).map(arg => {
            if (!(arg instanceof Error)) {
              return { type: 'string', value: format(arg) };
            }
            return {
              type: 'object',
              subtype: 'error',
              className: 'Error',
              description: v.stack || v.message || v
            };
          })
        }
      });
    }

    return notify;
  }
};
