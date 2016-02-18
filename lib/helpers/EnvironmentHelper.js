'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.EnvironmentHelper',

  inject: co.wrap(function * (backend) {

    const evaluate = yield backend.plugin('NodeInspector.EvalHelper');

    /**
     * @type {Object} environment descriptor
     */
    let env = {};

    /**
     * Update running state on message received
     */
    backend.on('message', msg => {
      if (typeof msg.running === 'boolean') env.running = msg.running;
      if (msg.type === 'event' &&
          (msg.event === 'break' || msg.event === 'exception')) {
        env.running = false;
      }
    });

    /**
     * @type {Promise<Object>}
     */
    const result = yield evaluate(`JSON.stringify({
      pid: process.pid,
      cwd: process.cwd(),
      filename: process.mainModule ? process.mainModule.filename : process.argv[1],
      nodeVersion: process.version
    })`);

    const running = env.running;
    env = JSON.parse(result.value);
    env.running = running;

    return env;
  })
};
