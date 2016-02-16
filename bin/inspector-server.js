#!/usr/bin/env node

'use strict';

const debug = require('debug');

const Config = require('../lib/Config');
const Server = require('../lib/Server');
const bind = require('../lib/util').bind;
const log = require('../lib/util').log;

function startServer(opts, logger) {
  logger = logger || debug;

  const server = new Server(opts);

  const logServer = logger('ni:server');
  const logBackend = logger('ni:backend');
  const logFrontend = logger('ni:frontend');

  log(server, {
    listening: null,
    close: null,
    connection: null,
    error: error => [error.stack || error.message || error]
  }, logServer);

  bind(server, {

    backend(b) {
      log(b, {
        connect: null,
        ready: null,
        close: null,
        unhndledMessage: null,
        send: data => [JSON.stringify(data)],
        message: msg => [JSON.stringify(msg)],
        error: error => [error.stack || error.message || error]
      }, logBackend);
    },

    frontend(f) {
      log(f, {
        open: null,
        send: data => [data],
        message: msg => [JSON.stringify(msg)],
        error: error => [error.stack || error.message || error],
        close: (code, msg) => [code, msg]
      }, logFrontend);
    }
  });

  return server.start();
}

if (require.main === module) {
  startServer(new Config().getData());
}
module.exports = startServer;
