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
  const logError = logger('ni:error');

  log(server, {
    listening: [],
    close: [],
    connection: [],
    error: error => [error.stack || error.message || error]
  }, logServer);

  log(server, {
    error: error => [error.stack || error.message || error]
  }, logError);

  bind(server, {

    backend(b) {

      log(b, {
        connect: [],
        ready: [],
        close: [],
        unhndledMessage: [],
        send: data => [JSON.stringify(data)],
        message: msg => [JSON.stringify(msg)],
        error: error => [error.stack || error.message || error]
      }, logBackend);

      log(b, {
        error: error => [error.stack || error.message || error]
      }, logError);
    },

    frontend(f) {

      log(f, {
        open: [],
        send: data => [data],
        message: msg => [JSON.stringify(msg)],
        error: error => [error.stack || error.message || error],
        close: (code, msg) => [code, msg]
      }, logFrontend);

      log(f, {
        error: error => [error.stack || error.message || error]
      }, logError);
    }
  });

  return server.start();
}

if (require.main === module) {
  startServer(new Config().getData());
}
module.exports = startServer;
