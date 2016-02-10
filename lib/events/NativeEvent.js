'use strict';

const co = require('co');
const ScriptHelper = require('../helpers/ScriptHelper');

module.exports = {
  
  break(context, msg) {
    return co(function * () {
      const backend = context.backend;
      yield backend.ready;
      if (backend.running) return;
      if (backend.status.skipAllPauses) {
        yield backend.request('continue');
        return;
      }
      const source = ScriptHelper.resolveScriptById(msg.script.id);
      if ((!source || source.hidden) && !msg.exception) {
        yield backend.request('continue', { stepaction: 'out' });
        return;
      }
      backend.continueToLocationBreakpointId = null;

      const exception = msg.exception || false;
      const callFrames = yield backend.request('Debugger.getBacktrace', {
        stackTraceLimit: context.config.stackTraceLimit
      });

      return {
        method: 'Debugger.paused',
        params: {
          callFrames,
          reason: exception ? 'exception' : 'other',
          hitBreakpoints: msg.hitBreakpoints || false,
          data: exception ? { type: 'object', desc: exception.text || 'Error' } : undefined
        }
      };
    });
  },

  exception(context, msg) {
    return this.break(context, msg);
  },

  afterCompile(context, msg) {
    return co(function * () {
      return {
        method: 'Debugger.scriptParsed',
        params: context.backend.scriptManager.addScript(msg.script)
      };
    });
  }
};
