'use strict';

const WSServer = require('ws').Server;
const express = require('express');
const enableDestroy = require('server-destroy');
const qs = require('qs');
const url = require('url');
const path = require('path');
const http = require('http');
const https = require('https');
const debug = require('debug');
const EventEmitter = require('events');
const log = require('./util').log;
const Backend = require('./Backend');
const Frontend = require('./Frontend');
const net = require('net');
const favicon = require('serve-favicon');

const webroot = path.join(__dirname, '../front-end');
const indexPath = path.join(webroot, 'inspector.html');
const faviconPath = path.join(__dirname, '../front-end-node/Images/favicon.png');

class Server extends EventEmitter {

  constructor(config) {
    super();

    const app = express();

    let httpSvr;
    if (config.ssl) {
      httpSvr = https.createServer(config.ssl, app);
    } else {
      httpSvr = http.createServer(app);
    }

    enableDestroy(httpSvr);

    const sockSvr = new WSServer({ server: httpSvr });

    sockSvr.on('connection', this._createSession.bind(this));

    app.use(favicon(faviconPath));

    app.get('/inspector.json', this._handleInspectorRequest.bind(this));
    app.get('/protocol.json', this._handleProtocolRequest.bind(this));
    app.get('/InspectorBackendCommands.js', this._handleEmptyRequest.bind(this));
    app.get('/SupportedCSSProperties.js', this._handleEmptyRequest.bind(this));

    app.get('/', this._handleIndexRequest.bind(this));

    const modules = config.modules.filter(m => m.path).sort((a, b) => a.path.length - b.path.length);
    for (let module of modules) {
      app.use('/' + module.name, express.static(path.join(__dirname, module.path)));
    }

    app.use('/', express.static(webroot));

    const logger = debug('node-inspector:server');

    httpSvr.once('close', log(httpSvr, {
      listening: 'listening',
      close: 'close',
      error: error => ['error', error]
    }, logger));

    sockSvr.once('close', log(sockSvr, {
      error: error => ['error', error]
    }, logger));

    this.config = config;
    this.app = app;

    this.httpSvr = httpSvr;
    this.sockSvr = sockSvr;

    this.backends = {};
  }

  start() {
    this.httpSvr.listen(this.config.port, this.config.host);
  }

  close() {
    this.httpSvr.destroy();
    const promises = [];
    for (let port of Object.keys(this.backends)) {
      if (this.backends[port]) {
        promises.push(this.backends[port].close());
      }
    }
    return Promise.all(promises);
  }

  _createSession(conn) {
    const query = qs.parse(url.parse(conn.upgradeReq.url).query);
    const port = query.port || this.config.debugPort;
    const host = query.host || this.config.debugHost;

    if (!this.backends[port]) {
      const backend = this.backends[port] = new Backend(net.createConnection(port, host), this.config);

      const unbind = log(backend, {
        connect: 'connected',
        ready: 'ready',
        close: 'closed',
        unhndledMessage: 'unhandled message',
        send: data => ['send', data],
        message: msg => ['message', JSON.stringify(msg.body)],
        error: error => ['error', error.stack || error.message || error]
      }, debug('node-inspector:backend:' + port));

      backend.once('close', () => {
        this.backends[port] = null;
        unbind();
      });
    }

    const frontend = new Frontend(conn, this.backends[port], this.config);

    frontend.once('close', log(frontend, {
      open: 'opened',
      send: data => ['send', data],
      message: msg => ['message', JSON.stringify(msg)],
      error: error => ['error', error.stack || error.message || error],
      close: (code, msg) => ['closed', code, msg]
    }, debug('node-inspector:frontend')));
  }

  _handleInspectorRequest(req, res) {
    const prior = m => +(m.type === 'worker');
    res.json(this.config.modules.sort((a, b) => prior(a) - prior(b)));
  }

  _handleProtocolRequest(req, res) {
    res.json({ version: { major: '1', minor: '1' }, domains: this.config.domains });
  }

  _handleEmptyRequest(req, res) {
    res.end('{}');
  }

  _handleIndexRequest(req, res) {
    res.sendFile(indexPath);
  }
}

module.exports = Server;
