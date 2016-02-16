// This module will be injected into the target process.

var debug = require('v8-debug');
var Debug = debug.runScript('Debug');

debug.enable();

debug.registerCommand('NodeInspector.restartFrame', function(req, res) {
  if (this.running_) return;
  var callFrameId = req.arguments.callFrameId;
  var currentCallStack = debug.wrapCallFrames(this.exec_state_, 50, 1);
  debug.InjectedScript.restartFrame(currentCallStack, callFrameId);

  var currentCallStack = debug.wrapCallFrames(this.exec_state_, 50, 3);
  var callFrames = debug.InjectedScript.wrapCallFrames(currentCallStack);

  res.body = { callFrames: callFrames || [] };
});

debug.registerCommand('NodeInspector.injectModule', function(req, res) {
  require(req.arguments.path).inject(req.arguments.opts);
});

debug.registerCommand('NodeInspector.disable', function(req, res) {
  debug.disable();
});
