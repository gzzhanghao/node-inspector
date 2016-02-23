'use strict';

const co = require('co');
const defer = require('../util').defer;

module.exports = {

  name: 'NodeInspector.DomainHelper',

  inject: backend => backend.on('frontend', frontend => {

    const domains = Object.create(null);

    frontend.handleCommands((method, params, next) => {
      const domain = method.split('.')[0];
      if (domains[domain] && domains[domain].pending) {
        domains[domain].resolve();
      } else {
        domains[domain] = Promise.resolve();
      }
      return next(method, params);
    });

    frontend.handleEvents(co.wrap(function * (method, params, next) {
      const domain = method.split('.')[0];
      if (!domains[domain]) {
        domains[domain] = defer();
      }
      yield domains[domain];
      return yield next(method, params);
    }));
  })
};
