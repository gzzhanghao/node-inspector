'use strict';

const co = require('co');

module.exports = function(session) {

  const config = session.config;
  const backend = session.backend;
  const scripts = backend.scripts;

  session.registerEvents({

    break(msg) {
      return co(function * () {
        yield backend.ready;

        if (backend.running) return;

        if (backend.status.skipAllPauses) {
          yield session.request('continue');
          return;
        }

        // Check if source is hidden
        const source = scripts.resolveScriptById(msg.script.id);
        if ((!source || source.hidden) && !msg.exception) {
          yield session.request('continue', { stepaction: 'out' });
          return;
        }
        backend.status.continueToLocationBreakpointId = null;

        // Send backtrace to frontend
        const callFrames = yield session.request('Debugger.getBacktrace', {
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
      return session.send('break', msg.body);
    },

    afterCompile(msg) {
      return Promise.resolve({
        method: 'Debugger.scriptParsed',
        params: scripts.addScript(msg.script)
      });
    }
  });
};
