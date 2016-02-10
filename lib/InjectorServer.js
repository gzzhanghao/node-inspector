/**
* @param {Array} options
*/
function injectorServer(options) {
  var debug = require(options['v8-debug'])();
  debug.enableWebkitProtocol();
  debug.convert = require(options['convert']);

  var injections = options.injections;
  for (var i = injections.length - 1; i >= 0; i--) {
    require(injections[i])(require, debug, {});
  }
}

exports.inject = injectorServer;
