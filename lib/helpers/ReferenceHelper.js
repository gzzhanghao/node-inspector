'use strict';

module.exports = {

  name: 'NodeInspector.ReferenceHelper',

  inject(backend) {
    let count = 0;

    backend.on('frontend', frontend => {
      count += 1;

      frontend.once('close', () => {
        count -= 1;
        if (!count) backend.close();
      });
    });
  }
};
