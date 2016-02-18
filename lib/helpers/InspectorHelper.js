'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.InspectorHelper',

  inject: co.wrap(function * (backend) {

    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');

    // @todo override WebInspector.ExecutionContextSelector.completionsForTextPromptInCurrentContext
    // for auto completion

    protocol.registerCommands({
      'Debugger.evaluateOnCallFrame': handleInspectorCommand,
      'Runtime.evaluate': handleInspectorCommand
    });

    /**
     * Handle inspector commands
     *
     * @param {Object}   params
     * @param {Function} orig
     *
     * @return {any}
     */
    function handleInspectorCommand(params, orig) {
      if (params.expression[0] !== '#') return orig(params);
      let args = [];
      let command = params.expression.slice(1);
      if (params.expression.indexOf(' ') > 0) {
        args = command.slice(command.indexOf(' '));
        command = command.slice(0, command.indexOf(' '));
      }
      // @todo handle inspector command
      return orig(params);
    }
  })
};
