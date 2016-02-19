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
  const logPlugin = logger('ni:plugin');

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
        send: data => [data],
        message: msg => {
          if (msg.event !== 'afterCompile') {
            return [JSON.stringify(msg)];
          }
        },
        error: error => [error.stack || error.message || error]
      }, logBackend);

      log(b, {
        plugin: event => [event.name, event.type, event.error]
      }, logPlugin);

      log(b, {
        error: error => [error.stack || error.message || error]
      }, logError);
    },

    frontend(f) {
      log(f, {
        open: [],
        send: data => {
          const msg = JSON.parse(data);
          if (msg.method !== 'Debugger.scriptParsed') {
            return [data];
          }
        },
        message: msg => [JSON.stringify(msg)],
        error: error => [error.stack || error.message || error],
        close: (code, msg) => [code, msg]
      }, logFrontend);

      log(f, {
        error: error => [error.stack || error.message || error]
      }, logError);

      log(f, {
        error: error => [error.stack || error.message || error]
      }, console.log.bind(console, 'NodeInspector Frontend'));
    }
  });

  return server.start();
}

if (require.main === module) {
  startServer(new Config().getData());
}
module.exports = startServer;
