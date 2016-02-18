'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.EvalHelper',

  inject(backend) {

    /**
     * Evaluate an expression in global context
     *
     * @param {string}      expression Expression to be evaluate
     * @param {Object|void} options    Options for the evaluate request
     *
     * @return {Promise<Object>} response of the evaluate request
     */
    return (expression, opts) => backend.request('evaluate', Object.assign({
      expression, global: true
    }, opts));
  }
};
