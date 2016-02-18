'use strict';

const fs = require('fs');
const co = require('co');

module.exports = {

  name: 'NodeInspector.PreloadHelper',

  inject: co.wrap(function * (backend) {

    const scriptHelper = yield backend.plugin('NodeInspector.ScriptHelper');

    // @todo
  })
};
