// This function will be injected into the target process.

var debug = require('v8-debug');
var InjectedScript = debug.InjectedScript;

exports.inject = function(options) {

  debug.registerCommand('Runtime.evaluate', function(req, res) {
    var args = req.arguments;

    var result = InjectedScript.evaluate(
      args.expression,
      args.objectGroup,
      args.injectCommandLineAPI,
      args.returnByValue,
      args.generatePreview
    );
    res.body = result;
  });

  debug.registerCommand('Runtime.callFunctionOn', function(req, res) {
    var args = req.arguments;

    var result = InjectedScript.callFunctionOn(
      args.objectId,
      args.functionDeclaration,
      JSON.stringify(args.arguments),
      args.returnByValue
    );
    res.body = result;
    if (typeof result === 'string') {
      res.error = new Error(result);
      res.body = { wasThrown: true };
    }
  });

  debug.registerCommand('Runtime.getProperties', function(req, res) {
    var args = req.arguments;

    var result = {
      result: InjectedScript.getProperties(
        args.objectId,
        args.ownProperties,
        args.accessorPropertiesOnly,
        args.generatePreview
      )
    };

    if (!args.accessorPropertiesOnly) {
      result.internalProperties = InjectedScript.getInternalProperties(args.objectId);
    }

    res.body = result;
  });

  debug.registerCommand('Runtime.releaseObject', function(req, res) {
    var args = req.arguments;
    debug.releaseObject(args.objectId);
  });

  debug.registerCommand('Runtime.releaseObjectGroup', function(req, res) {
    var args = req.arguments;
    debug.releaseObjectGroup(args.objectGroup);
  });
};
