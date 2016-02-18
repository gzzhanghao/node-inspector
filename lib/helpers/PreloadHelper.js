'use strict';

const fs = require('fs');
const co = require('co');
const promisify = require('bluebird').promisify;

module.exports = {

  name: 'NodeInspector.PreloadHelper',

  inject: co.wrap(function * (backend) {

    const scriptHelper = yield backend.plugin('NodeInspector.ScriptHelper');

    // @todo
  })
};