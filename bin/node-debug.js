#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const fork = require('child_process').fork;
const debug = require('debug');
const open = require('biased-opener');
const whichSync = require('which').sync;

const Config = require('../lib/Config');

const bind = require('../lib/util').bind;
const log = require('../lib/util').log;

const startServer = require('./inspector-server');

const debugDebugger = debug('node-inspector:debugger');
const debugBrowser = debug('node-inspector:browser');

function nodeDebug() {
  const config = new Config().getData();

  // 1. start debug server

  const server = startServer(config);
  server.once('close', () => process.exit());

  // 2. start debug process

  let script = config._[0];
  if (!fs.existsSync(script)) {
    if (!fs.existsSync(script + '.js')) {
      try {
        script = whichSync(script);
      } catch (error) {
        // noop
      }
    } else {
      script += '.js';
    }
  }

  const childProcess = fork(script, config._.slice(1), {
    execArgv: [
      config.debugBrk ? '--debug-brk' : '--debug',
      `--debug-port=${config.debugPort}`
    ]
  });
  childProcess.once('close', () => process.exit());

  log(childProcess, {
    error: error => [error.stack || error.message || error]
  }, debugDebugger);

  // 3. open browser

  open(getUrl(config), { preferredBrowsers : ['chrome', 'chromium', 'opera'] }, error => {
    if (!error) return;
    debugBrowser('error', error.message);
    console.log('Please open the URL manually in Chrome/Chromium/Opera or similar browser');
  });

  // 4. bind listeners

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

  log(server, {
    listening: `Debug server is listening at ${config.host}:${config.port}`,
    error: error => ['Debug server error', error],
    close: 'Debug server closed'
  });

  log(childProcess, {
    close: 'Debug process close',
    disconnect: 'Debug process disconnect',
    error: error => ['Debug process error', error],
    exit: 'Debug process exit'
  });

  process.once('exit', () => {
    childProcess.kill();
    server.close();
  });

  process.on('SIGINT', () => process.exit());
  process.on('SIGQUIT', () => process.exit());
}

function getUrl (config) {
  return `${config.ssl ? 'https' : 'http'}://${config.host}:${config.port}`;
}

nodeDebug();
