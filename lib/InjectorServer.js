/**
* @param {Array} options
*/
function injectorServer(options) {
  var debug = require(options['v8-debug'])();
  debug.enableWebkitProtocol();

  global.process._require = require;
  global.process._debugObject = debug;

  debug.convert = require(options['convert']);

  debug.on('close', () => {
    delete global.process._require;
    delete global.process._debugObject;
  });

  var injections = Object.keys(options.injections);
  for (var i = injections.length - 1; i >= 0; i--) {
    require(injections[i])(require, debug, options.injection[injections[i]]);
  }
}

module.exports = injectorServer;
