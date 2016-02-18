#!/usr/bin/env node

'use strict';

const path = require('path');
const fork = require('child_process').fork;
const co = require('co');
const fs = require('mz/fs');
const debug = require('debug');
const open = require('biased-opener');
const whichSync = require('which').sync;

const Config = require('../lib/Config');

const bind = require('../lib/util').bind;
const log = require('../lib/util').log;

const startServer = require('./inspector-server');

const debugDebugger = debug('ni:debugger');
const debugBrowser = debug('ni:browser');

const nodeDebug = co.wrap(function * () {
  const config = new Config().getData();

  // find debug process

  let found;
  let script = config._[0];

  yield fs.stat(script).then(stat => {
    if (stat.isFile()) found = script;
  }).catch(() => {
    // noop
  });

  if (!found) {
    yield fs.stat(script + '.js').then(stat => {
      if (stat.isFile()) found = script + '.js';
    }).catch(() => {
      // noop
    });
  }

  if (!found) {
    found = whichSync(script);
  }

  // start debug server

  const server = startServer(config);

  // fork debug process

  const childProcess = fork(found, config._.slice(1), {
    execArgv: [
      '--debug-brk',
      `--debug-port=${config.debugPort}`
    ]
  });

  // open browser

  open(getUrl(config), { preferredBrowsers : ['chrome', 'chromium', 'opera'] }, error => {
    if (!error) return;
    debugBrowser('error', error.message);
    console.log('Please open the URL manually in Chrome/Chromium/Opera or similar browser');
  });

  // encount reference

  let ref = 0;

  function unref() {
    ref -= 1;
    if (!ref) server.close();
  }

  bind(server, {
    backend(b) {
      ref += 1;
      bind(b, { close: unref });
    }
  });

  // bind loggings

  log(childProcess, {
    error: error => [error.stack || error.message || error]
  }, debugDebugger);

  log(childProcess, {
    error: error => ['Debug process error', error],
  });

  // bind exits

  childProcess.once('close', () => process.exit());
  server.once('close', exit);

  process.on('SIGINT', exit);
  process.on('SIGQUIT', exit);
  process.on('SIGTERM', exit);

  function exit() {
    childProcess.kill();
    server.close();
    process.exit();
  }
});

function getUrl (config) {
  return `${config.ssl ? 'https' : 'http'}://${config.host}:${config.port}`;
}

nodeDebug();
