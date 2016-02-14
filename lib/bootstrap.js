'use strict';

const Config = require('./Config');
const Server = require('./Server');
const debug = require('debug');

const bind = require('./util').bind;
const log = require('./util').log;

const debugServer = debug('node-inspector:server');
const debugBackend = debug('node-inspector:backend');
const debugFrontend = debug('node-inspector:frontend');

module.exports = function(opts) {
  const config = new Config(opts);
  const server = new Server(config.getData());

  log(server, {
    listening: null,
    close: null,
    connection: null,
    error: error => [error]
  }, debugServer);

  bind(server, {

    backend: backend => {
      log(backend, {
        connect: null,
        ready: null,
        close: null,
        unhndledMessage: null,
        send: data => [data],
        message: msg => [JSON.stringify(msg.body)],
        error: error => [error.stack || error.message || error]
      }, debugBackend);
    },

    frontend: frontend => {
      log(frontend, {
        open: null,
        send: data => [data],
        message: msg => [JSON.stringify(msg)],
        error: error => [error.stack || error.message || error],
        close: (code, msg) => [code, msg]
      }, debugFrontend);
    }
  });
  
  server.start();

  return server;
};

module.exports();
