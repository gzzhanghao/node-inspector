'use strict';

module.exports = {

  name: Symbol('NodeInspector.DebugBrkHelper'),

  inject(backend) {

    if (!backend.config.debugBrk) {

      backend.ready.catch(error => {})

        .then(() => backend.plugin('NodeInspector.DebuggerAgent'))

        .then(() => backend.request('Debugger.resume'))

        .catch(error => {
          backend.emit('error', error);
        });
    }
  }
};
