'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.InspectorAgent',

  inject: co.wrap(function * (backend) {

    const env = yield backend.plugin('NodeInspector.EnvironmentHelper');
    const notify = yield backend.plugin('NodeInspector.NotifyHelper');
    const evaluate = yield backend.plugin('NodeInspector.EvalHelper');
    const protocolHelper = yield backend.plugin('NodeInspector.ProtocolHelper');

    protocolHelper.registerEvents({
      'NodeInspector.processExit': () => {
        notify('warning', 'Debugger process exit');
      }
    });

    // Pause if we are running
    const running = env.running;
    if (running) yield backend.request('suspend');

    // Get scope of console getter
    const expr = `Object.getOwnPropertyDescriptor(global, 'console').get`;
    const func = yield evaluate(expr);
    const scope = yield backend.request('scope', {
      functionHandle: func.handle
    });

    // Find NativeModule object in console getter's scope
    const props = scope.refs[scope.object.ref].properties;
    const NM = props.filter(prop => prop.name === 'NativeModule')[0];
    if (!NM) throw new Error('No NativeModule in target scope');

    // Initialize injector server options
    const serverPath = JSON.stringify(require.resolve('./InspectorInjection'));

    // Inject injector server into target process
    const result = yield evaluate(
      `NM.require('module')._load(${serverPath}).inject({})`,
      { additional_context: [{ name: 'NM', handle: NM.ref }] }
    );

    // Resume the debug context if we were paused
    if (running) yield backend.request('continue');

    /**
     * Inject specific module into backend process
     *
     * @param {string} path    Path to injection module
     * @param {Object} opts Options for injected module
     */
    return (path, opts) => backend.request(
      'NodeInspector.injectModule', {
        path, opts
      }
    );
  })
};
