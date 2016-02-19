'use strict';

exports.log = function(host, handlers, logger_) {
  const logger = logger_ || console.log.bind(console);
  const events = Object.keys(handlers);
  const listeners = {};
  for (let event of events) {
    if (typeof handlers[event] !== 'function') {
      listeners[event] = () => logger(event, handlers[event]);
    } else {
      listeners[event] = function() {
        var args = handlers[event].apply(handlers, arguments);
        if (args != null) logger.apply(null, [event].concat(args));
      };
    }
  }
  return exports.bind(host, listeners);
};

exports.bind = function(host, events, context) {
  const handlers = {};
  const keys = Object.keys(events);
  for (let event of keys) {
    host.on(event, handlers[event] = events[event].bind(context));
  }
  const unbind = () => {
    for (let event of keys) {
      host.removeListener(event, handlers[event]);
    }
  };
  host.once('close', unbind);
  return unbind;
};

exports.defer = function() {
  let resolver;
  const promise = new Promise((resolve, reject) => {
    resolver = { resolve: wrap(resolve), reject: wrap(reject) };
  });
  promise.pending = true;
  function wrap(fn) {
    return function() {
      promise.pending = false;
      return fn.apply(this, arguments);
    };
  }
  return Object.assign(promise, resolver);
};
