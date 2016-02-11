'use strict';

const co = require('co');
const debug = require('debug');
const EventEmitter = require('events');

const Backend = require('./Backend');
const Frontend = require('./Frontend');

const log = require('./util').log;
const flatten = require('./util').flatten;
const shortStr = require('./util').shortStr;

const debugSession = debug('node-inspector:session');
const debugBackend = debug('node-inspector:backend');
const debugFrontend = debug('node-inspector:frontend');

class Session extends EventEmitter {

  constructor(frontConn, config) {
    super();

    // Public parameters
    this.config = config;
    this.backend = new Backend(config);
    this.frontend = new Frontend(frontConn, config);

    this.events = {};
    this.commands = {};

    // Binding events
    this.backend.once('close', this._onBackendClose.bind(this));
    this.backend.on('error', this._onBackendError.bind(this));
    this.backend.on('event', this._onBackendEvent.bind(this));

    this.frontend.once('close', this._onFrontendClose.bind(this));
    this.frontend.on('message', this._onFrontendMsg.bind(this));

    this._emitError = this.emit.bind(this, 'error');

    // Load plugins
    for (let plugin of config.plugins) {
      plugin(this);
    }

    // Binding loggers
    log(this, {
      error: error => ['error', error.stack || error.message || error]
    }, debugSession);

    log(this.backend, {
      open: 'opened',
      connect: 'connected',
      ready: 'ready',
      close: 'closed',
      unhndledMessage: 'unhandled message',
      send: data => ['send', data],
      message: msg => ['message', JSON.stringify(msg.body)],
      error: error => ['error', error.stack || error.message || error]
    }, debugBackend);

    log(this.frontend, {
      open: 'opened',
      send: data => ['send', data],
      message: msg => ['message', JSON.stringify(msg)],
      error: error => ['error', error.stack || error.message || error],
      close: (code, msg) => ['closed', code, msg]
    }, debugFrontend);
  }

  registerCommands(commands) {
    Object.assign(this.commands, commands);
  }

  registerEvents(events) {
    Object.assign(this.events, events);
  }

  close() {
    return co(function * () {
      yield this.backend.close();
      yield this.frontend.close();
    }.bind(this));
  }

  request(type, args) {
    return co(function * () {
      const handler = this.commands[type];

      if (handler == null) {
        return yield this.backend.request(type, args);
      } else if (typeof handler !== 'function') {
        return handler;
      }

      return yield Promise.resolve().then(() => handler(args, type));
    }.bind(this));
  }

  send(method, params) {
    return co(function * () {
      let result = { method, params };

      const handler = this.events[method];
      if (typeof handler === 'function') {
        result = yield handler(params, method);
        if (result == null) {
          return;
        }
      }

      yield this.frontend.send(result);
    }.bind(this));
  }

  _onBackendClose(reason) {
    co(function * () {
      this.frontend.close();
      this.emit('close');
    }.bind(this)).catch(this._emitError);
  }

  _onBackendError(error) {
    this.frontend.sendLog('error', 'Backend error -', error).catch(this._emitError);
  }

  _onBackendEvent(event) {
    this.send(event.event, event.body).catch(error => {
      return this.frontend.sendLog('error', 'EventHandler error -', error);
    }).catch(this._emitError);
  }

  _onFrontendClose(code, msg) {
    co(function * () {
      yield this.backend.close();
      this.emit('close');
    }.bind(this)).catch(this._emitError);
  }

  _onFrontendMsg(msg) {
    const id = msg.id;
    co(function * () {
      const result = yield this.request(msg.method, msg.params);
      if (result != null) yield this.frontend.send({ id, result });
    }.bind(this)).catch(error => {
      return this.frontend.send({ id, error });
    }).catch(this._emitError);
  }
}

module.exports = Session;
