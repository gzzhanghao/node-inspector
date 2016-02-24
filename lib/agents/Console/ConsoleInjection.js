// This function will be injected into the target process.

var debug = require('v8-debug');
var util = require('util');
var format = util.format;
var inspect = util.inspect;

exports.inject = function(options) {

  var nextMessageId = 1;

  function ConsoleMessage(fn, wrapper, args) {
    var location = getCallerFuncLocation(wrapper);

    this.id = nextMessageId++;
    this.source = 'console-api';
    this.level = getLevel(fn);
    this.type = this.level === 'log' ? fn : undefined;
    this.line = location.line;
    this.column = location.column;
    this.url = location.url;
    this.repeatCount = 0;
    this.timestamp = Date.now();
    this.parameters = args;
  }

  function getLevel(fn) {
    return {
      warn: 'warning',
      error: 'error',
      debug: 'debug'
    }[fn] || 'log';
  }

  function getCallerFuncLocation(wrapper) {
    var _prepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = function(error, stack) { return stack; };

    var error = new Error();
    Error.captureStackTrace(error, wrapper);
    var callerFrame = error.stack[1];

    Error.prepareStackTrace = _prepareStackTrace;

    var url = callerFrame.getFileName() || callerFrame.getEvalOrigin();

    return {
      url: url,
      line: callerFrame.getLineNumber(),
      column: callerFrame.getColumnNumber()
    };
  }

  function fnCalledFromConsole(fn) {
    var _prepareStackTrace = Error.prepareStackTrace;
    var _stackTraceLimit = Error.stackTraceLimit;

    Error.prepareStackTrace = function(error, stack) { return stack; };
    Error.stackTraceLimit = Infinity;

    var error = new Error();
    Error.captureStackTrace(error, fn);
    var stack = error.stack.length;

    var result = ['dir', 'log', 'info', 'warn', 'error'].filter(function(level) {
      var error = new Error();
      Error.captureStackTrace(error, console.Console.prototype[level]);
      return stack - (error.stack.length || NaN) === 1;
    })[0];

    Error.prepareStackTrace = _prepareStackTrace;
    Error.stackTraceLimit = _stackTraceLimit;
    return result;
  }

  function sendMessageToInspector(fn, wrapper, args) {
    var message = new ConsoleMessage(fn, wrapper, args);
    debug.emitEvent('Console.messageAdded', function(res) {
      message.parameters = message.parameters.map(function(arg) {
        return debug.InjectedScript.wrapObject(arg, 'console', true, true);
      });
      res.body = { message: message };
    });
  }

  debug.registerCommand('Console.clearMessages', function() {
    debug.releaseObjectGroup('console');
    debug.emitEvent('Console.messagesCleared');
  });

  util.format = function WRAPPED_BY_NODE_INSPECTOR() {
    var fn = fnCalledFromConsole(util.format);
    if (fn) {
      var args = Array.prototype.slice.call(arguments);
      sendMessageToInspector(fn, WRAPPED_BY_NODE_INSPECTOR, args);
    }
    return format.apply(this, arguments);
  };

  util.inspect = function WRAPPED_BY_NODE_INSPECTOR() {
    var fn = fnCalledFromConsole(util.inspect);
    if (fn) sendMessageToInspector(fn, WRAPPED_BY_NODE_INSPECTOR, [arguments[0]]);
    return inspect.apply(this, arguments);
  };

  return function() {
    util.inspect = inspect;
    util.format = format;
  };
};
