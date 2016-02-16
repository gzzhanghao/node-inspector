module.exports = function(backend) {
  return backend.inject(require.resolve('./ConsoleInjection'));
};
