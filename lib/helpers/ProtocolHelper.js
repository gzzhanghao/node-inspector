'use strict';

module.exports = function(backend) {

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
    backend[`register${type}`] = regs => Object.assign(set, regs);

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
};
