'use strict';

const Config = require('./Config');
const Server = require('./Server');

module.exports = function(opts) {
  const config = new Config(opts);
  const server = new Server(config.getData());
  server.start();
  return server;
};

module.exports();
