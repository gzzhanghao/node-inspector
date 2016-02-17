const co = require('co');

module.exports = {

  name: 'NodeInspector.ConsoleAgent',

  inject: co.wrap(function * (backend) {

    // @depend inject
    yield backend.plugin('NodeInspector.InjectorAgent');

    return backend.inject(require.resolve('./ConsoleInjection'));
  })
};
