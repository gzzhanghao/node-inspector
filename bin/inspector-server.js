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

  const plugins = opts.plugins
    .filter(p => typeof p === 'function')
    .map(p => p.name);

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
        close: [],
        unhndledMessage: [],
        send: data => [data],
        plugin: event => {
          plugins.splice(plugins.indexOf(event.name), 1);
          if (plugins.length) {
            logBackend('plugin', 'pendings:', plugins.join(', '));
          }
          return [event.name, event.type, event.error];
        },
        message: msg => [JSON.stringify(msg).slice(0, 200)],
        error: error => [error.stack || error.message || error]
      }, logBackend);

      log(b, {
        error: error => [error.stack || error.message || error]
      }, logError);

      b.ready.then(() => logBackend('ready'));
    },

    frontend(f) {
      log(f, {
        open: [],
        send: data => [data],
        message: msg => [JSON.stringify(msg).slice(0, 200)],
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
