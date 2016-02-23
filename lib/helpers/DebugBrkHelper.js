'use strict';

module.exports = {

  name: 'NodeInspector.DebugBrkHelper',

  inject(backend) {

    if (!backend.config.debugBrk) {
      backend.ready
        .then(() => backend.request('Debugger.resume'))
        .catch(error => backend.emit('error', error));
    }
  }
};
