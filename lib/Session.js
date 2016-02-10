'use strict';

const co = require('co');
const debug = require('debug');
const EventEmitter = require('events');
const DebuggerClient = require('./DebuggerClient');
const FrontendClient = require('./FrontendClient');
const log = require('./util').log;
const flatten = require('./util').flatten;

const debugSession = debug('node-inspector:session');
const debugFrontend = debug('node-inspector:frontend');
const debugDebugger = debug('node-inspector:debugger');

class Session extends EventEmitter {

  constructor(frontConn, config) {
    super();

    this._config = config;
    this._emitError = this.emit.bind(this, 'error');

    this._debugger = new DebuggerClient(config);
    this._frontend = new FrontendClient(frontConn, config);

    this._eventHandler = Object.assign({}, ...config.plugins.map(v => v.events));
    this._requestHandler = Object.assign({}, ...config.plugins.map(v => flatten(v.commands)));

    this.status = {};
    this._context = {
      config,
      session: this,
      frontend: this._frontend,
      backend: this._debugger
    };

    this._frontend.on('close', this._onFrontendClose.bind(this));
    this._frontend.on('message', this._onFrontendMsg.bind(this));

    this._debugger.on('close', this._onDebuggerClose.bind(this));
    this._debugger.on('error', this._onDebuggerError.bind(this));
    this._debugger.on('event', this._onDebuggerEvent.bind(this));

    log(this, {
      error: error => ['error', error.stack || error.message || error]
    }, debugSession);

    log(this._frontend, {
      open: 'opened',
      send: data => ['send', data],
      message: msg => ['message', JSON.stringify(msg, shortStr)],
      error: error => ['error', error.stack || error.message || error],
      close: (code, msg) => ['closed', code, msg]
    }, debugFrontend);

    log(this._debugger, {
      open: 'opened',
      connect: 'connected',
      ready: 'ready',
      close: 'closed',
      unhndledMessage: 'unhandled message',
      send: data => ['send', data],
      message: msg => ['message', JSON.stringify(msg.body, shortStr)],
      error: error => ['error', error.stack || error.message || error]
    }, debugDebugger);
  }

  close() {
    return co(function * () {
      yield this._debugger.close();
      this._frontend.close();
    }.bind(this));
  }

  request(type, args) {
    return co(function * () {
      const handler = this._requestHandler[type];
      if (handler == null) {
        return yield this._debugger.request(type, args);
      } else if (typeof handler !== 'function') {
        return handler;
      }
      return yield Promise.resolve().then(() => handler.call(this._requestHandler, this._context, args, type));
    }.bind(this));
  }

  send(msg) {
    if (typeof msg === 'string') {
      throw msg;
    }
    return this._frontend.send(msg);
  }

  _onFrontendClose(code, msg) {
    co(function * () {
      yield this._debugger.close();
      this.emit('close');
    }.bind(this)).catch(this._emitError);
  }

  _onDebuggerClose(reason) {
    co(function * () {
      this._frontend.close();
      this.emit('close');
    }.bind(this)).catch(this._emitError);
  }

  _onDebuggerError(error) {
    this._frontend.sendLog('error', 'Debugger error -', error).catch(this._emitError);
  }

  _onFrontendMsg(msg) {
    const id = msg.id;
    co(function * () {
      const result = yield this.request(msg.method, msg.params);
      if (result != null) yield this.send({ id, result });
    }.bind(this)).catch(error => {
      return this.send({ id, error });
    }).catch(this._emitError);
  }

  _onDebuggerEvent(event) {
    co(function * () {
      const handler = this._eventHandler[event.event];
      let result = handler;
      if (typeof handler === 'function') {
        result = yield handler.call(this._eventHandler, this._context, event.body, event.event);
      } else if (handler == null) {
        debugSession('Unhandled event', event.event, JSON.stringify(event.body, shortStr));
        result = { method: event.event, params: event.body };
      }
      if (result != null) yield this.send(result);
    }.bind(this)).catch(error => {
      return this._frontend.sendLog('error', 'EventHandler error -', error);
    }).catch(this._emitError);
  }
}

function shortStr(key, val) {
  if (typeof val === 'string') {
    return val.slice(0, 50);
  }
  return val;
}

module.exports = Session;
