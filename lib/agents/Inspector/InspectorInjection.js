// This module will be injected into the target process.

var debug = require('v8-debug');
var Debug = debug.runScript('Debug');

exports.inject = function(options) {

  var heartbeat = 1;
  var plugins = [];

  var heartbeatWatcher = setInterval(function() {
    if (heartbeat-- < 0) disable();
  }, options.heartbeatInterval).unref();

  debug.enable();

  debug.registerCommand('NodeInspector.injectModule', function(req, res) {
    var plugin = require(req.arguments.path);
    plugins.push(plugin.inject(req.arguments.opts));
  });

  debug.registerCommand('NodeInspector.heartbeat', function(req, res) {
    heartbeat++;
  });

  debug.registerCommand('NodeInspector.disable', disable);

  process.on('beforeExit', beforeExit);

  function beforeExit() {
    debug.emitEvent('NodeInspector.processExit');
    heartbeatWatcher.ref();
  }

  function disable() {
    debug.disable();
    process.removeListener('beforeExit', beforeExit);
    clearInterval(heartbeatWatcher);
    for (var i = plugins.length - 1; i >= 0; i--) {
      if (plugins[i]) plugins[i]();
    }
  }
};
