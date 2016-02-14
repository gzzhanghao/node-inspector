'use strict';

const co = require('co');

module.exports = function(backend) {

  const config = backend.config;
  const scripts = backend.scripts;

  backend.registerEvents({

    break(msg) {
      return co(function * () {
        yield backend.ready;

        if (backend.running) return;

        if (backend.status.skipAllPauses) {
          yield backend.request('continue');
          return;
        }

        // Check if source is hidden
        const source = scripts.resolveScriptById(msg.script.id);
        if ((!source || source.hidden) && !msg.exception) {
          yield backend.request('continue', { stepaction: 'out' });
          return;
        }

        if (backend.status.continueToLocationBreakpointId != null) {
          yield backend.request('clearBreakpoint', {
            breakpoint: backend.status.continueToLocationBreakpointId
          });
          backend.status.continueToLocationBreakpointId = null;
        }

        // Send backtrace to frontend
        const callFrames = yield backend.request('Debugger.getBacktrace', {
          stackTraceLimit: config.stackTraceLimit
        });

        return {
          method: 'Debugger.paused',
          params: {
            callFrames,
            reason: msg.exception ? 'exception' : 'other',
            hitBreakpoints: msg.hitBreakpoints || false,
            data: msg.exception ? { type: 'object', desc: msg.exception.text || 'Error' } : undefined
          }
        };
      });
    },

    exception(msg) {
      return backend.emitEvent('break', msg);
    },

    afterCompile(msg) {
      return Promise.resolve({
        method: 'Debugger.scriptParsed',
        params: scripts.addScript(msg.script)
      });
    },

    scriptCollected(msg) {
      scripts.removeScript(msg.script);
    }
  });
};
