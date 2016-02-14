// This function will be injected into the target process.

var injectionKey = '--node-inspector-runtime-injection--';

exports.inject = function(debug, options, state) {

  if (state[injectionKey]) return;
  state[injectionKey] = true;

  var InjectedScript = debug.InjectedScript;

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
