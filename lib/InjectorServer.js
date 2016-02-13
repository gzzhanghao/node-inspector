/**
 * @param {Array} options
 */
function injectorServer(options) {
  var debug = require(options['v8-debug'])();
  debug.enableWebkitProtocol();

  var injections = options.injections;
  for (var i = injections.length - 1; i >= 0; i--) {
    require(injections[i])(require, debug, options.config);
  }
}

exports.inject = injectorServer;
