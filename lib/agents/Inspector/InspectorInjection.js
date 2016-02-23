// This module will be injected into the target process.

var debug = require('v8-debug');
var Debug = debug.runScript('Debug');

exports.inject = function(options) {

  var exitHolder;

  debug.enable();

  debug.registerCommand('NodeInspector.injectModule', function(req, res) {
    require(req.arguments.path).inject(req.arguments.opts);
  });

  debug.registerCommand('NodeInspector.disable', function(req, res) {
    clearInterval(exitHolder);
    debug.disable();
  });

  process.on('beforeExit', function() {
    debug.emitEvent('NodeInspector.processExit');
    exitHolder = setInterval(() => {}, 1e10);
  });
};
