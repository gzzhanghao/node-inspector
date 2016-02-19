// This function will be injected into the target process.

var debug = require('v8-debug');
var CallFrame = debug.JavaScriptCallFrame;
var InjectedScript = debug.InjectedScript;
var DebuggerScript = debug.DebuggerScript;

exports.inject = function(options) {

  var stackTraceLimit = options.stackTraceLimit;

  debug.registerCommand('Debugger.evaluateOnCallFrame', function(req, res) {
    var execState = this.exec_state_;
    var args = req.arguments;

    var result = InjectedScript.evaluateOnCallFrame(
      debug.wrapCallFrames(execState, execState.frameCount(), 3),
      false,
      args.callFrameId,
      args.expression,
      args.objectGroup,
      args.includeCommandLineAPI,
      args.returnByValue,
      args.generatePreview
    );

    res.body = result;
    if (typeof result === 'string') {
      res.error = new Error(result);
      res.body = { wasThrown: true };
    }
  });

  debug.registerCommand('Debugger.getFunctionDetails', function(req, res) {
    var result = InjectedScript.getFunctionDetails(req.arguments.functionId);
    if (typeof result === 'string') throw new Error(result);
    res.body = { details: result };
  });

  debug.registerCommand('Debugger.setVariableValue', function(req, res) {
    var execState = this.exec_state_;
    var args = req.arguments;

    var error = InjectedScript.setVariableValue(
      debug.wrapCallFrames(execState, execState.frameCount(), 3),
      args.callFrameId,
      args.functionObjectId,
      args.scopeNumber,
      args.variableName,
      JSON.stringify(args.newValue)
    );

    if (error) throw new Error(error);
  });

  debug.registerCommand('Debugger.restartFrame', function(req, res) {
    if (this.running_) return;
    var callFrameId = req.arguments.callFrameId;
    var currentCallStack = debug.wrapCallFrames(this.exec_state_, stackTraceLimit, 1);
    var result = InjectedScript.restartFrame(currentCallStack, callFrameId);
    if (typeof result === 'string') throw new Error(result);
    _getBacktrace.call(this, req, res);
  });

  debug.registerCommand('Debugger.pause', function(req, res) {
    if (!this.running_) return;
    debug.setPauseOnNextStatement(true);
  });

  debug.registerCommand('Debugger.stepOver', function(req, res) {
    if (this.running_) return;
    var frame = debug.wrapCallFrames(this.exec_state_, 1, 0);
    if (frame.isAtReturn) return _stepInto.call(this, req, res);
    _continue.call(this, req, res);
    DebuggerScript.stepOverStatement(this.exec_state_);
  });

  debug.registerCommand('Debugger.stepOut', function(req, res) {
    if (this.running_) return;
    _continue.call(this, req, res);
    DebuggerScript.stepOutOfFunction(this.exec_state_);
  });

  debug.registerCommand('Debugger.resume', _continue);
  debug.registerCommand('Debugger.stepInto', _stepInto);
  debug.registerCommand('Debugger.getBacktrace', _getBacktrace);

  function _getBacktrace(req, res) {
    var callFrames = [];

    if (!this.running_) {
      var currentCallStack = debug.wrapCallFrames(this.exec_state_, stackTraceLimit, 3);
      var callFrames = InjectedScript.wrapCallFrames(currentCallStack);

      // TODO
      // var asyncStackTrace = ...
    }

    res.body = { callFrames: callFrames };
  }

  function _continue(req, res) {
    if (this.running_) return;
    debug.releaseObjectGroup('backtrace');
    debug.emitEvent('Debugger.resumed');
    res.running = true;
  }

  function _stepInto(req, res) {
    if (this.running_) return;
    _continue.call(this, req, res);
    DebuggerScript.stepIntoStatement(this.exec_state_);
  }
};
