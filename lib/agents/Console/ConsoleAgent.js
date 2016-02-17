const co = require('co');

module.exports = {

  name: 'NodeInspector.ConsoleAgent',

  inject: co.wrap(function * (backend) {

    const inject = yield backend.plugin('NodeInspector.InjectorAgent');

    yield inject(require.resolve('./ConsoleInjection'));
  })
};
