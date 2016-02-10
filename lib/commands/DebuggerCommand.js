'use strict';

const co = require('co');
const ScriptHelper = require('../helpers/ScriptHelper');

exports.Debugger = {

  enable(context) {
    return co(function * () {
      const session = context.session;
      const backend = context.backend;

      if (context.frontend.status.debuggerEnabled) return;
      context.frontend.status.debuggerEnabled = true;

      backend.scriptManager.reset();
      const scripts = yield session.request('scripts', { types: 4, includeSource: true });
      scripts.forEach(script => {
        context.frontend.send({
          method: 'Debugger.scriptParsed',
          params: backend.scriptManager.addScript(script)
        });
      });

      if (backend.running) return;
      const callFrames = yield backend.request('Debugger.getBacktrace', {
        stackTraceLimit: context.config.stackTraceLimit
      });

      session.send({
        method: 'Debugger.paused',
        params: {
          callFrames,
          reason: 'other',
          hitBreakpoints: false
        }
      });
    });
  },

  setPauseOnExceptions(context, params) {
    return co(function * () {
      yield Promise.all([
        { type: 'all', enabled: params.state == 'all' },
        { type: 'uncaught', enabled: params.state == 'uncaught' }
      ].map(args => context.session.request('setExceptionBreak', args)));
    });
  },

  setBreakpointByUrl(context, params) {
    return co(function * () {
      if (typeof params.urlRegex !== 'undefined') {
        throw new Error('Debugger.setBreakpointByUrl using urlRegex is not implemented.');
      }

      const result = yield context.session.request('setBreakpoint', {
        enabled: backend.status.breakpointsActive,
        type: 'script',
        target: params.url,
        line: params.lineNumber,
        column: params.columnNumber,
        condition: params.condition
      });

      return {
        breakpointId: result.breakpoint.toString(),
        locations: result.actual_locations
      };
    });
  },

  setBreakpoint(context, params) {
    return co(function * () {
      const result = yield context.session.request('setBreakpoint', {
        enabled: backend.status.breakpointsActive,
        type: 'scriptId',
        target: params.location.scriptId,
        line: params.location.lineNumber,
        column: params.location.columnNumber,
        condition: params.condition
      });

      return {
        breakpointId: result.breakpoint.toString(),
        location: result.actual_locations[0]
      }
    });
  },

  removeBreakpoint(context, params) {
    return co(function * () {
      yield context.session.request('clearBreakpoint', {
        breakpoint: params.breakpointId
      });
    });
  },

  continueToLocation(context, params) {
    return co(function * () {
      const session = context.session;
      const backend = context.backend;
      if (backend.status.continueToLocationBreakpointId != null) {
        yield session.request('clearBreakpoint', {
          breakpoint: backend.status.continueToLocationBreakpointId
        });
        backend.status.continueToLocationBreakpointId = null;
      }
      const result = yield session.request('Debugger.setBreakpoint', params);
      backend.status.continueToLocationBreakpointId = result.breakpointId;
      session.request('Debugger.resume');
    });
  },

  setBreakpointsActive(context, params) {
    return co(function * () {
      const session = context.session;
      const enabled = params.active;
      context.backend.status.breakpointsActive = enabled;
      const result = yield session.request('listBreakpoints');
      yield Promise.all(
        result.breakpoints.map(breakpoint => session.request('changeBreakpoint', {
          enabled,
          breakpoint: breakpoint.number
        }))
      );
    });
  },

  setSkipAllPauses(context, params) {
    context.backend.status.skipAllPauses = params.skipped;
  },

  getScriptSource(context, params) {
    return co(function * () {
      return { scriptSource: yield ScriptHelper.getScriptSource(context, params.scriptId) };
    });
  },

  setScriptSource(context, params) {
    return co(function * () {
      const result = yield ScriptHelper.setScriptSource(
        context,
        params.scriptId,
        params.scriptSource,
        params.preview
      );

      let callFrames;
      if (result.stack_modified && !result.stack_update_needs_step_in) {
        try {
          callFrames = yield session.request('Debugger.getBacktrace');
        } catch (error) {
          // noop
        }
      }

      return { callFrames, stackChanged: result.stack_modified };
    });
  }
};
