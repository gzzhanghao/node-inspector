// This function will be injected into the target process.
module.exports = function injection(require, debug, options) {
  var stackTraceLimit = options.stackTraceLimit;
  var CallFrame = debug.CallFrame;

  debug.registerAgentCommand('Debugger.evaluateOnCallFrame',
    ['callFrameId', 'expression', 'objectGroup',
        'includeCommandLineAPI', 'returnByValue', 'generatePreview'],
    function(args, response, InjectedScript) {
      var execState = this.exec_state_;
      var maximumLimit = execState.frameCount();
      args.unshift(debug.wrapCallFrames(execState, maximumLimit, 3), false);

      response.body = InjectedScript.evaluateOnCallFrame.apply(InjectedScript, args);
    });

  debug.registerAgentCommand('Debugger.getFunctionDetails',
    ['functionId'],
    function(args, response, InjectedScript) {
      var details = InjectedScript.getFunctionDetails.apply(InjectedScript, args);
      response.body = { details: details };
    });

  debug.registerAgentCommand('Debugger.setVariableValue',
    ['callFrameId', 'functionObjectId', 'scopeNumber', 'variableName', 'newValue'],
    function(args, response, InjectedScript) {
      var execState = this.exec_state_;
      var maximumLimit = execState.frameCount();
      args.unshift(debug.wrapCallFrames(execState, maximumLimit, 3));
      args[5] = JSON.stringify(args[5]);

      var error = InjectedScript.setVariableValue.apply(InjectedScript, args);
      if (error) {
        response.body = {
          error: {
            message: error
          }
        };
      }
    });

  debug.registerAgentCommand('Debugger.pause', _pause);
  debug.registerAgentCommand('Debugger.resume', _continue);
  debug.registerAgentCommand('Debugger.stepOver', _stepOver);
  debug.registerAgentCommand('Debugger.stepInto', _stepInto);
  debug.registerAgentCommand('Debugger.stepOut', _stepOut);
  debug.registerAgentCommand('Debugger.restartFrame', ['callFrameId'], _restartFrame);
  debug.registerAgentCommand('Debugger.getBacktrace', _getBacktrace);


  function _getBacktrace(args, response, InjectedScript) {
    if (this.running_) return;

    var currentCallStack = debug.wrapCallFrames(this.exec_state_, stackTraceLimit, 3);
    var callFrames = InjectedScript.wrapCallFrames(currentCallStack);
    // TODO
    // var asyncStackTrace = ...

    response.body = callFrames || [];
  }

  function _restartFrame(args, response, InjectedScript, DebuggerScript) {
    if (this.running_) return;

    var callFrameId = args[0];
    var currentCallStack = debug.wrapCallFrames(this.exec_state_, stackTraceLimit, 1);
    InjectedScript.restartFrame(currentCallStack, callFrameId);
    _getBacktrace.call(this, args, response, InjectedScript);
  }

  function _pause(args, response, InjectedScript) {
    if (!this.running_) return;

    debug.setPauseOnNextStatement(true);
  }

  function _continue(args, response, InjectedScript) {
    if (this.running_) return;

    debug.releaseObjectGroup('backtrace');
    debug.emitEvent('Debugger.resumed');
    response.running = true;
  }

  function _stepOver(args, response, InjectedScript, DebuggerScript) {
    if (this.running_) return;

    var frame = debug.wrapCallFrames(this.exec_state_, 1, 0);
    if (frame.isAtReturn) {
      return _stepInto.call(this, args, response, InjectedScript, DebuggerScript);
    }

    _continue.call(this, args, response, InjectedScript);
    DebuggerScript.stepOverStatement(this.exec_state_);
  }

  function _stepInto(args, response, InjectedScript, DebuggerScript) {
    if (this.running_) return;

    _continue.call(this, args, response, InjectedScript);
    DebuggerScript.stepIntoStatement(this.exec_state_);
  }

  function _stepOut(args, response, InjectedScript, DebuggerScript) {
    if (this.running_) return;

    _continue.call(this, args, response, InjectedScript);
    DebuggerScript.stepOutOfFunction(this.exec_state_);
  }
};
