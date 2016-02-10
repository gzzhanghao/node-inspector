'use strict';

exports.log = function(host, handlers, logger_) {
  const logger = logger_ || console.log.bind(console);
  for (let event of Object.keys(handlers)) {
    if (typeof handlers[event] === 'string') {
      host.on(event, () => logger(handlers[event]));
      continue;
    }
    host.on(event, (...args) => {
      logger(...handlers[event](...args));
    });
  }
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
