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
          text: format.apply(null, [].slice.call(arguments, 1)),
          timestamp: Date.now(),
          repeatCount: 0
        }
      });
    }

    notify.persist = function(level/*, ...msg*/) {
      backend.welcomeMessages.push({
        level,
        message: [].slice.call(arguments, 1)
      });
      return notify.apply(null, arguments);
    };

    return notify;
  }
};
