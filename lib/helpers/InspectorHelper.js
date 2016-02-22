'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.InspectorHelper',

  inject: co.wrap(function * (backend) {

    const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');

    const commands = Object.create(null);

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
      const index = command.indexOf(' ');
      if (index > 0) {
        args = command.slice(index);
        command = command.slice(0, index);
      }
      const handler = commands[command.trim()];
      try {
        if (!handler) throw new Error(`Unknown command ${command.trim()}`);
        return {
          wasThrown: false,
          result: handler(args)
        };
      } catch (error) {
        return {
          wasThrown: true,
          result: error,
          exceptionDetails: {
            text: error.stack || error.message || error,
            scriptId: -1,
            line: 0,
            column: 0
          }
        };
      }
    }

    return {

      registerCommands(commands) {
        for (const name of Object.keys(commands)) {
          this.registerCommand(name, commands[name]);
        }
      },

      registerCommand(name, handler) {
        const origin = commands[name] || () => {};
        commands[name] = args => handler(args, origin);
      }
    };
  })
};
