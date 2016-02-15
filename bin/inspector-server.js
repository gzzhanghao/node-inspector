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

  const logServer = logger('node-inspector:server');
  const logBackend = logger('node-inspector:backend');
  const logFrontend = logger('node-inspector:frontend');

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
        send: data => [data],
        message: msg => [JSON.stringify(msg.body)],
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
