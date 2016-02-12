var http = require('http'),
    https = require('https'),
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    extend = require('util')._extend,
    fs = require('fs'),
    path = require('path'),
    express = require('express'),
    favicon = require('serve-favicon'),
    WebSocketServer = require('ws').Server,
    buildInspectorUrl = require('../index.js').buildInspectorUrl,
    buildWebSocketUrl = require('../index.js').buildWebSocketUrl,
    plugins = require('./plugins'),
    InspectorJson = plugins.InspectorJson,
    ProtocolJson = plugins.ProtocolJson,
    OVERRIDES = path.join(__dirname, '../front-end-node'),
    WEBROOT = path.join(__dirname, '../front-end');

const net = require('net');
const log = require('./util').log;
const debug = require('debug');
const Frontend = require('./Frontend');
const Backend = require('./Backend');

function debugAction(req, res) {
  if (!req.query.ws)
    return redirectToRoot.call(this, req, res);

  res.sendFile(path.join(WEBROOT, 'inspector.html'));
}

function redirectToRoot(req, res) {
  return res.redirect(this._getUrlFromReq(req));
}

function inspectorJson(req, res) {
  res.send(this._inspectorJson);
}

function emptyJson(req, res) {
  res.send('{}');
}

function jsonAction(req, res) {
  res.json([{
   'description': 'Node.js app (powered by node-inspector)',
   'devtoolsFrontendUrl': this.address().url,
   'id': process.pid,
   'title': process.title ||'',
   'type': 'page',
   'url': '',
   'webSocketDebuggerUrl': this.wsAddress().url
  }]);
}

function jsonVersionAction(req, res) {
  res.json({
    'browser': 'Node ' + process.version,
    'protocol-version': '1.1',
    'user-agent': 'Node ' + process.version,
    // webKit-version is a dummy value as it's used to match compatible DevTools front-ends
    'webKit-version': '537.36 (@181352)'
  });
}

function protocolJson(req, res) {
  res.send(this._protocolJson);
}

function handleWebSocketConnection(socket) {
  var debugPort = this._getDebuggerPort(socket.upgradeReq.url);
  this._createSession(debugPort, socket);
}

function handleServerListening() {
  this.emit('listening');
}

function handleServerError(err) {
  if (err._handledByInspector) return;
  err._handledByInspector = true;
  this.emit('error', err);
}

function DebugServer() {}

inherits(DebugServer, EventEmitter);

DebugServer.prototype.start = function(options) {
  this._config = extend({}, options);
  this._isHTTPS = this._config.sslKey && this._config.sslCert ? true : false;

  plugins.init(this._config);

  this._inspectorJson = new InspectorJson(this._config);
  this._protocolJson = new ProtocolJson(this._config);

  var PLUGINS = plugins.CWD;

  var app = express();
  var httpServer;

  if (this._isHTTPS) {
    httpServer = https.createServer({
      key: fs.readFileSync(this._config.sslKey, {encoding: 'utf8'}),
      cert: fs.readFileSync(this._config.sslCert, {encoding: 'utf8'})
    }, app);
  } else {
    httpServer = http.createServer(app);
  }

  this._httpServer = httpServer;

  app.use(favicon(path.join(__dirname, '../front-end-node/Images/favicon.png')));

  // Json handshake
  app.get('/json', jsonAction.bind(this));
  app.get('/json/list', jsonAction.bind(this));
  app.get('/json/version', jsonVersionAction.bind(this));

  // Dynamically generated front-end content
  app.get('/inspector.json', inspectorJson.bind(this));
  app.get('/protocol.json', protocolJson.bind(this));
  app.get('/InspectorBackendCommands.js', emptyJson);
  app.get('/SupportedCSSProperties.js', emptyJson);

  // Main routing
  app.get('/', debugAction.bind(this));
  app.get('/debug', redirectToRoot.bind(this));
  app.use('/node', express.static(OVERRIDES));
  app.use('/plugins', express.static(PLUGINS));
  app.use(express.static(WEBROOT));

  this.wsServer = new WebSocketServer({
    server: httpServer
  });
  this.wsServer.on('connection', handleWebSocketConnection.bind(this));
  this.wsServer.on('error', handleServerError.bind(this));

  httpServer.on('listening', handleServerListening.bind(this));
  httpServer.on('error', handleServerError.bind(this));
  httpServer.listen(this._config.webPort, this._config.webHost);

  this._config.debuggerCloseTimeout = 100;

  this._config.plugins = [
    require('./helpers/StatusHelper'),
    require('./helpers/ScriptHelper'),
    require('./events/NativeEvent'),
    require('./commands/PageCommand'),
    require('./commands/NativeCommand'),
    require('./commands/RuntimeCommand'),
    require('./commands/DebuggerCommand'),
    backend => backend.addInjections([
      require.resolve('./injections/ConsoleInjection'),
      require.resolve('./injections/DebuggerInjection'),
      require.resolve('./injections/RuntimeInjection')
    ])
  ];
};

DebugServer.prototype._getDebuggerPort = function(url) {
  return parseInt((/[\?\&]port=(\d+)/.exec(url) || [null, this._config.debugPort])[1], 10);
};

DebugServer.prototype._getUrlFromReq = function(req) {
  var urlParts = req.headers.host.split(':'),
      debugPort = this._getDebuggerPort(req.url);
  return buildInspectorUrl(urlParts[0], urlParts[1], debugPort, null, this._isHTTPS);
};

DebugServer.prototype._createSession = function(debugPort, wsConnection) {

  if (!this._backend) {
    this._backend = new Backend(net.createConnection(this._config.debugPort), this._config);

    log(this._backend, {
      connect: 'connected',
      ready: 'ready',
      close: 'closed',
      unhndledMessage: 'unhandled message',
      send: data => ['send', data],
      message: msg => ['message', JSON.stringify(msg.body)],
      error: error => ['error', error.stack || error.message || error]
    }, debug('node-inspector:backend'));
  }

  const frontend = new Frontend(wsConnection, this._backend, this._config);
  log(frontend, {
    open: 'opened',
    send: data => ['send', data],
    message: msg => ['message', JSON.stringify(msg)],
    error: error => ['error', error.stack || error.message || error],
    close: (code, msg) => ['closed', code, msg]
  }, debug('node-inspector:frontend'));
};

DebugServer.prototype.close = function() {
  if (this.wsServer) {
    this.wsServer.close();
    this.emit('close');
  }
};

DebugServer.prototype.address = function() {
  var address = this._httpServer.address();
  var config = this._config;
  address.url = buildInspectorUrl(config.webHost, address.port, config.debugPort, null, this._isHTTPS);
  return address;
};

DebugServer.prototype.wsAddress = function() {
  var address = this._httpServer.address();
  var config = this._config;
  address.url = buildWebSocketUrl(config.webHost, address.port, config.debugPort, null, this._isHTTPS);
  return address;
};

exports.DebugServer = DebugServer;
