'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.DebuggerAgent',

  inject: co.wrap(function * (backend) {

    const env = yield backend.plugin('NodeInspector.EnvironmentHelper');
    const inject = yield backend.plugin('NodeInspector.InspectorAgent');
    const transaction = yield backend.plugin('NodeInspector.TransactionHelper');
    const scriptHelper = yield backend.plugin('NodeInspector.ScriptHelper');
    const protocolHelper = yield backend.plugin('NodeInspector.ProtocolHelper');

    const status = {
      breakpointsActive: true,
      skipAllPauses: false,
      continueToBreakpoint: null
    };

    yield inject(require.resolve('./DebuggerInjection'), {
      stackTraceLimit: backend.config.stackTraceLimit
    });

    protocolHelper.registerEvents({
      'exception': handleBreakEvent,
      'break': handleBreakEvent
    });

    protocolHelper.registerCommands({

      'Debugger.enable': () => co(function * () {
        yield scriptHelper.reload();

        if (env.running) return;

        const result = yield backend.request('Debugger.getBacktrace');
        const callFrames = result.callFrames;

        backend.emitEvent('Debugger.paused', {
          callFrames,
          reason: 'other',
          hitBreakpoints: false
        });
      }),

      'Debugger.setPauseOnExceptions': params => co(function * () {
        yield Promise.all([
          { type: 'all', enabled: params.state == 'all' },
          { type: 'uncaught', enabled: params.state == 'uncaught' }
        ].map(args => backend.request('setExceptionBreak', args)));
      }),

      'Debugger.setBreakpointByUrl': params => co(function * () {
        const result = yield backend.request('setBreakpoint', {
          enabled: status.breakpointsActive,
          type: 'script',
          target: scriptHelper.url2path(params.url),
          line: params.lineNumber,
          column: params.columnNumber,
          condition: params.condition
        });

        return {
          breakpointId: result.breakpoint.toString(),
          locations: result.actual_locations.map(
            l => scriptHelper.location(l)
          )
        };
      }),

      'Debugger.setBreakpoint': params => co(function * () {
        const result = yield backend.request('setBreakpoint', {
          enabled: status.breakpointsActive,
          type: 'scriptId',
          target: params.location.scriptId,
          line: params.location.lineNumber,
          column: params.location.columnNumber,
          condition: params.condition
        });

        return {
          breakpointId: result.breakpoint.toString(),
          location: scriptHelper.location(result.actual_locations[0])
        }
      }),

      'Debugger.removeBreakpoint': params => {
        return backend.request('clearBreakpoint', {
          breakpoint: params.breakpointId
        });
      },

      'Debugger.continueToLocation': params => co(function * () {
        if (status.continueToBreakpoint != null) {
          yield backend.request('clearBreakpoint', {
            breakpoint: status.continueToBreakpoint
          });
          status.continueToBreakpoint = null;
        }
        const result = yield backend.request(
          'Debugger.setBreakpoint',
          params
        );
        status.continueToBreakpoint = result.breakpointId;
        backend.request('Debugger.resume');
      }),

      'Debugger.setBreakpointsActive': params => co(function * () {
        status.breakpointsActive = params.active;

        const result = yield backend.request('listBreakpoints');
        yield Promise.all(
          result.breakpoints.map(breakpoint => backend.request(
            'changeBreakpoint', {
              enabled: params.active,
              breakpoint: breakpoint.number
            }
          ))
        );
      }),

      'Debugger.setSkipAllPauses': params => {
        status.skipAllPauses = params.skipped;
      },

      'Debugger.getScriptSource': params => co(function * () {
        return {
          scriptSource: yield scriptHelper.getScriptSource(params.scriptId)
        };
      }),

      'Debugger.setScriptSource': params => co(function * () {
        const result = yield scriptHelper.setScriptSource(
          params.scriptId,
          params.scriptSource,
          params.preview
        );

        let callFrames;
        if (result.stack_modified && !result.stack_update_needs_step_in) {
          try {
            callFrames = yield backend.request('Debugger.getBacktrace');
          } catch (error) {
            // noop
          }
        }

        return { callFrames, stackChanged: result.stack_modified };
      })
    });

    function handleBreakEvent(msg) {
      return transaction(co.wrap(function * (request) {
        if (env.running) return;

        if (status.skipAllPauses) {
          yield request('continue');
          return;
        }

        const script = scriptHelper.getScriptById(msg.script.id);
        if ((!script || script.hidden) && !msg.exception) {
          yield request('continue', {
            stepaction: 'out'
          });
          return;
        }

        if (status.continueToBreakpoint != null) {
          yield request('clearBreakpoint', {
            breakpoint: status.continueToBreakpoint
          });
          status.continueToBreakpoint = null;
        }

        let data;
        if (msg.exception) {
          data = { type: 'object', desc: msg.exception.text || 'Error' };
        }

        const result = yield request('Debugger.getBacktrace');
        const callFrames = result.callFrames;

        return {
          method: 'Debugger.paused',
          params: {
            data,
            callFrames,
            reason: msg.exception ? 'exception' : 'other',
            hitBreakpoints: msg.hitBreakpoints || false
          }
        };
      }));
    }
  })
};
