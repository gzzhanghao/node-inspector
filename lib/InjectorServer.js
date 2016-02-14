var nodeInspectorKey = '--node-inspector-key--';

/**
 * @param {Array} options
 */
function injectorServer(options) {

  var debug = require(options['v8-debug']);

  var Debug = debug.runScript('Debug');
  if (!Debug[nodeInspectorKey]) {
    Debug[nodeInspectorKey] = {};
  }
  var state = Debug[nodeInspectorKey];

  debug.enable();

  for (var i = options.injections.length - 1; i >= 0; i--) {
    try {
      require(options.injections[i]).inject(debug, options.config, state);
    } catch (error) {
      debug.emitEvent('NodeInspector.injectionError', { error: error.stack });
    }
  }
}

exports.inject = injectorServer;
