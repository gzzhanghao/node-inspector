'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.InjectorAgent',

  inject: co.wrap(function * (backend) {

    const env = yield backend.plugin('NodeInspector.EnvironmentHelper');

    // Pause if we are running
    const running = env.running;
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
    if (running) yield backend.request('continue');

    /**
     * Inject specific module into backend process
     *
     * @param {string} path    Path to injection module
     * @param {Object} opts Options for injected module
     */
    return (path, opts) => backend.request('NodeInspector.injectModule', { path, opts });
  })
};
