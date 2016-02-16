'use strict';

const co = require('co');

module.exports = function(backend) {

  /**
   * @type boolean running Whether backend is running
   */
  let running = true;

  /**
   * @type {Promise<Object>} environment Backend environment descriptor
   */
  backend.environment = co(function * () {
    const env = yield backend.eval(`JSON.stringify({
      pid: process.pid,
      cwd: process.cwd(),
      filename: process.mainModule ? process.mainModule.filename : process.argv[1],
      nodeVersion: process.version
    })`);
    return JSON.parse(env.value);
  });

  /**
   * Check if backend process is running
   *
   * @return {Promise<boolean>} whether backend process is running
   */
  backend.running = co.wrap(function * () {
    yield this.environment;
    return running;
  });

  /**
   * Update running state on message received
   */
  backend.on('message', msg => {
    if (typeof msg.running === 'boolean') running = msg.running;
    if (msg.type === 'event' &&
        (msg.event === 'break' || msg.event === 'exception')) {
      running = false;
    }
  });
};
