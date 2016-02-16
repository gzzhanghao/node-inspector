module.exports = function(backend) {
  backend.inject(require.resolve('./ConsoleInjection'));
};
