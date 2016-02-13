'use strict';

exports.log = function(host, handlers, logger_) {
  const logger = logger_ || console.log.bind(console);
  const events = Object.keys(handlers);
  const listeners = {};
  for (let event of events) {
    if (typeof handlers[event] === 'string') {
      listeners[event] = () => logger(handlers[event]);
    } else {
      listeners[event] = (...args) => logger(...handlers[event](...args));
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
  return function() {
    for (let event of keys) {
      host.removeListener(event, handlers[event]);
    }
  };
};

exports.flatten = function(host) {
  if (!host) return null;
  const result = {};
  for (let domain of Object.keys(host)) {
    if (domain.indexOf('.') >= 0) {
      result[domain] = host[domain];
      continue;
    }
    for (let method of Object.keys(host[domain])) {
      result[`${domain}.${method}`] = host[domain][method];
    }
  }
  return result;
};
