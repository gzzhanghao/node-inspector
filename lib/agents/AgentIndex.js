'use strict';

module.exports = {

  name: 'NodeInspector.AgentIndex',

  inject(backend) {

    const r = require;

    return backend.plugin([
      r('./Console/ConsoleAgent'),
      r('./Debugger/DebuggerAgent'),
      r('./Inspector/InspectorAgent'),
      r('./Noop/NoopAgent'),
      r('./Page/PageAgent'),
      r('./Runtime/RuntimeAgent')
    ]);
  }
};
