'use strict';

module.exports = {

  name: 'NodeInspector.ProtocolHelper',

  inject(backend) {

    const protocol = {};

    for (const type of ['Event', 'Command']) {

      /**
       * @type {Object} set Map of custom handlers
       */
      const set = Object.create(null);

      /**
       * Register events / commands
       *
       * @param {Object} regs Map of custom handlers
       */
      protocol[`register${type}s`] = definitions => {
        for (const name of Object.keys(definitions)) {
          protocol[`register${type}`](name, definitions[name]);
        }
      };

      /**
       * Register signle event / command
       *
       * @param {string}   name
       * @param {Function} definition
       */
      protocol[`register${type}`] = (name, definition) => {
        if (!set[name]) set[name] = [];
        set[name].push(definition);
      };

      /**
       * Handler for custom events / commands
       */
      backend[`handle${type}s`]((method, params, orig) => {
        const handlers = set[method] || [];

        function next(index, nextParams) {
          let result = handlers[index];
          if (index < 0) {
            result = orig(method, nextParams);
          } else if (typeof result === 'function') {
            result = result(nextParams, next.bind(null, index - 1));
          }
          return Promise.resolve(result);
        }

        return next(handlers.length - 1, params);
      });
    }

    return protocol;
  }
};
