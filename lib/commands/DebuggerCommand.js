'use strict';

const co = require('co');
const flatten = require('../util').flatten;

module.exports = function(backend) {

  const config = backend.config;
  const scripts = backend.scripts;
  const status = backend.status;
  const convert = backend.convert;

  backend.registerCommands(flatten({

    Debugger: {

      enable() {
        return co(function * () {
          if (yield backend.running()) return;

          yield scripts.reload();

          const callFrames = yield backend.request('Debugger.getBacktrace', {
            stackTraceLimit: config.stackTraceLimit
          });

          backend.emitEvent('Debugger.paused', {
            callFrames,
            reason: 'other',
            hitBreakpoints: false
          });
        });
      },

      setPauseOnExceptions(params) {
        return co(function * () {
          yield Promise.all([
            { type: 'all', enabled: params.state == 'all' },
            { type: 'uncaught', enabled: params.state == 'uncaught' }
          ].map(args => backend.request('setExceptionBreak', args)));
        });
      },

      setBreakpointByUrl(params) {
        return co(function * () {
          const result = yield backend.request('setBreakpoint', {
            enabled: status.breakpointsActive,
            type: 'script',
            target: convert.url2path(params.url),
            line: params.lineNumber,
            column: params.columnNumber,
            condition: params.condition
          });

          return {
            breakpointId: result.breakpoint.toString(),
            locations: result.actual_locations.map(l => convert.location(l))
          };
        });
      },

      setBreakpoint(params) {
        return co(function * () {
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
            location: convert.location(result.actual_locations[0])
          }
        });
      },

      removeBreakpoint(params) {
        return backend.request('clearBreakpoint', { breakpoint: params.breakpointId });
      },

      continueToLocation(params) {
        return co(function * () {
          if (status.continueToLocationBreakpointId != null) {
            yield backend.request('clearBreakpoint', {
              breakpoint: status.continueToLocationBreakpointId
            });
            status.continueToLocationBreakpointId = null;
          }
          const result = yield backend.request('Debugger.setBreakpoint', params);
          status.continueToLocationBreakpointId = result.breakpointId;
          backend.request('Debugger.resume');
        });
      },

      setBreakpointsActive(params) {
        return co(function * () {
          status.breakpointsActive = params.active;

          const result = yield backend.request('listBreakpoints');
          yield Promise.all(
            result.breakpoints.map(breakpoint => backend.request('changeBreakpoint', {
              enabled: params.active,
              breakpoint: breakpoint.number
            }))
          );
        });
      },

      setSkipAllPauses(params) {
        status.skipAllPauses = params.skipped;
      },

      getScriptSource(params) {
        return co(function * () {
          return { scriptSource: yield scripts.getScriptSource(params.scriptId) };
        });
      },

      setScriptSource(params) {
        return co(function * () {
          const result = yield scripts.setScriptSource(
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
        });
      }
    }
  }));
};
