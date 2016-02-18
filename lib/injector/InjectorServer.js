// This module will be injected into the target process.

var debug = require('v8-debug');
var Debug = debug.runScript('Debug');

exports.inject = function(options) {

  debug.enable();

  debug.registerCommand('NodeInspector.restartFrame', function(req, res) {
    if (this.running_) return;
    var callFrameId = req.arguments.callFrameId;
    var currentCallStack = debug.wrapCallFrames(this.exec_state_, 50, 1);
    debug.InjectedScript.restartFrame(currentCallStack, callFrameId);
  });

  debug.registerCommand('NodeInspector.injectModule', function(req, res) {
    require(req.arguments.path).inject(req.arguments.opts);
  });

  debug.registerCommand('NodeInspector.disable', function(req, res) {
    debug.disable();
  });

  process.once('exit', function() {
    debug.emitEvent('NodeInspector.processExit');
  });
};
