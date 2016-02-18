'use strict';

module.exports = {

  name: 'NodeInspector.ProtocolHelper',

  inject(backend) {

    const protocolHelper = {};

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
      protocolHelper[`register${type}s`] = definitions => {
        for (const name of Object.keys(definitions)) {
          protocolHelper[`register${type}`](name, definitions[name]);
        }
      };

      /**
       * Register signle event / command
       *
       * @param {string}   name
       * @param {Function} definition
       */
      protocolHelper[`register${type}`] = (name, definition) => {
        if (!set[name]) set[name] = [];
        set[name].push(definition);
      };

      /**
       * Handler for custom events / commands
       */
      backend[`handle${type}s`]((type, args, orig) => {
        const handlers = set[type] || [];

        function next(index, params) {
          if (index < 0) return orig(type, params);
          const handler = handlers[index];
          if (typeof handler !== 'function') return handler;
          return handler(params, next.bind(null, index - 1));
        }

        return next(handlers.length - 1, args);
      });
    }

    return protocolHelper;
  }
};
