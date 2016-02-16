'use strict';

const co = require('co');
const defer = require('../util').defer;

const injectEvent = '__node_inspector__';

module.exports = function(backend) {

  /**
   * @type {Promise<Object>}
   */
  const serverReady = defer();

  /**
   * Inject specific module into backend process
   *
   * @param {string} path    Path to injection module
   * @param {Object} opts Options for injected module
   */
  backend.inject = co.wrap(function * (path, opts) {
    yield serverReady;
    yield this.request('NodeInspector.injectModule', { path, opts });
  });

  /**
   * Inject injector server into debugger process
   */
  return co(function * () {

    // Pause if we are running
    const running = yield backend.running();
    if (running) yield backend.request('suspend');

    // Get scope of console getter
    const expr = `Object.getOwnPropertyDescriptor(global, 'console').get`;
    const func = yield backend.eval(expr);
    const scope = yield backend.request('scope', {
      functionHandle: func.handle
    });

    // Find NativeModule object in console getter's scope
    const props = scope.refs[scope.object.ref].properties;
    const NM = props.filter(prop => prop.name === 'NativeModule')[0];
    if (!NM) throw new Error('No NativeModule in target scope');

    // Initialize injector server options
    const serverPath = JSON.stringify(require.resolve('./InjectorServer'));

    // Inject injector server into target process
    const result = yield backend.eval(
      `NM.require('module')._load(${serverPath})`,
      { additional_context: [{ name: 'NM', handle: NM.ref }] }
    );

    // Restart the debug context if we were paused
    if (running) {
      yield backend.request('continue');
    } else {
      yield backend.request('NodeInspector.restartFrame', { callFrameId: 0 });
      yield backend.request('continue', { stepaction: 'in' });
    }

    serverReady.resolve();

  }).catch(error => backend.emit('error', error));
};
