'use strict';

module.exports = {

  name: 'NodeInspector.ProtocolHelper',

  inject(backend) {

    const protocolHelper = {};

    for (const type of ['Events', 'Commands']) {

      /**
       * @type {Object} set Map of custom handlers
       */
      const set = Object.create(null);

      /**
       * Register events / commands
       *
       * @param {Object} regs Map of custom handlers
       *
       * @return {Object} full map of custom handlers
       */
      protocolHelper[`register${type}`] = regs => Object.assign(set, regs);

      /**
       * Handler for custom events / commands
       */
      backend[`handle${type}`](function(type, args, orig) {
        const handler = set[type];

        if (handler == null) {
          return orig(type, args);
        }

        if (typeof handler !== 'function') {
          return handler;
        }

        // @todo make this chainable
        return handler.call(this, args);
      });
    }

    return protocolHelper;
  }
};
