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
  const args = new Config();

  let restarted = false;

  args.addConfig({
    modules: [{ "name": "node/sdk", "type": "autostart" }],
    domains: [{
      "domain": "NodeInspector",
      "events": [
        {
          "name": "restart",
          "description": "Debugger process is going to restart"
        }
      ],
      "commands": [
        {
          "name": "enable",
          "description": "Enable NodeInspector module"
        }
      ]
    }],
    plugins: [
      co.wrap(function * (backend) {
        const inspector = yield backend.plugin('NodeInspector.InspectorHelper');
        const notify = yield backend.plugin('NodeInspector.NotifyHelper');
        const protocol = yield backend.plugin('NodeInspector.ProtocolHelper');

        protocol.registerCommands({
          'NodeInspector.enable': true
        });

        inspector.registerCommands({
          restart: co.wrap(function * (args) {
            try {
              yield backend.emitEvent('NodeInspector.restart');
            } catch (error) {
              notify('error', 'NodeInspector Server: Failed to notify restart event');
            }
            restart();
            restarted = true;
          })
        });

        if (restarted) {
          restarted = false;
          notify('warning', 'NodeInspector Server: Restarted');
        }
      })
    ]
  });

  const config = args.getData();

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

  let lock = false;
  let childProcess;

  function restart() {
    if (childProcess) childProcess.kill();

    lock = true;

    childProcess = fork(found, config._.slice(1), {
      execArgv: [`--debug-brk=${config.debugPort}`]
    });

    log(childProcess, {
      error: error => [error.stack || error.message || error]
    }, debugDebugger);

    childProcess.once('close', function() {
      if (this === childProcess) process.exit();
    });
  }

  restart();

  // open browser

  open(getUrl(config), {
    preferredBrowsers : ['chrome', 'chromium', 'opera']
  }, error => {
    if (!error) return;
    debugBrowser('error', error.message);
    console.log(
      'Please open the URL manually in Chrome/Chromium/Opera or similar browser'
    );
  });

  // encount reference

  let ref = 0;

  function unref() {
    ref -= 1;
    if (!lock && !ref) server.close();
  }

  bind(server, {
    backend(b) {
      ref += 1;
      lock = false;
      bind(b, { close: unref });
    }
  });

  // bind exits

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
