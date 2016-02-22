'use strict';

const co = require('co');
const EventEmitter = require('events');
const path = require('path');
const Protocol = require('_debugger').Protocol;
const defer = require('./util').defer;
const bind = require('./util').bind;

/**
 * @class Backend
 */
class Backend extends EventEmitter {

  /**
   * @param {Socket} connection
   * @param {Object} config
   */
  constructor(connection, config) {
    super();

    this.config = config;
    this.connected = defer();
    this.ready = Promise.resolve();
    this.messages = [];

    const protocol = new Protocol;

    protocol.onResponse = this._handleMsg.bind(this);

    bind(connection, {
      data: data => protocol.execute(data),
      error: error => this._handleError(error),
      close: () => this._handleClose(),
      end: () => this._handleEnd()
    });

    connection.setEncoding('utf8');
    this.setMaxListeners(this.config.maxBackendListeners);

    this._reqSeq = 1;
    this._callbacks = {};
    this._plugins = {};
    this._conn = connection;

    this._eventHandler = (method, params) => ({ method, params });
    this._commandHandler = this._sendRequest.bind(this);

    this.ready = this.plugin(plugins).catch(error => {
      this.emit('error', error);
    });
  }

  /**
   * Inject / get a plugin
   *
   * @param {Array|function|string|Object} plugin  Plugin's definition
   *
   * @return {Promise<any>} plugin's return value
   */
  plugin(plugin) {
    if (Array.isArray(plugin)) {
      return Promise.all(plugin.map(p => this.plugin(p)));
    }

    if (typeof plugin === 'function') {
      return plugin(this);
    }

    if (typeof plugin === 'string') {
      if (path.isAbsolute(plugin)) {
        return this.plugin(require(plugin));
      }
      if (!this._plugins[plugin]) {
        this._plugins[plugin] = defer();
      }
      return this._plugins[plugin];
    }

    const name = plugin.name;

    if (this._plugins[name] && !this._plugins[name].pending) {
      return this._plugins[name];
    }

    const inject = Promise.resolve(plugin.inject(this));
    
    inject.then(
      () => this.emit('plugin', { name, type: 'ready' }),
      error => this.emit('plugin', { name, type: 'error', error })
    );

    if (this._plugins[name]) {
      this._plugins[name].resolve(inject);
    } else {
      this._plugins[name] = inject;
    }

    return this._plugins[name];
  }

  /**
   * Set command handler of backend
   *
   * @param {Function} handler
   */
  handleCommands(handler) {
    const next = this._commandHandler;
    this._commandHandler = (method, params) => Promise.resolve(
      handler.call(this, method, params, next)
    );
  }

  /**
   * Set event handler of backend
   *
   * @param {Function} handler
   */
  handleEvents(handler) {
    const next = this._eventHandler;
    this._eventHandler = (method, params) => Promise.resolve(
      handler.call(this, method, params, next)
    );
  }

  /**
   * Send a debugger request
   *
   * @param {string}      method
   * @param {Object|void} params
   *
   * @return {Promise<Object>} response
   */
  request(method, params) {
    return this._commandHandler(method, params);
  }

  /**
   * Emit a debugger event
   *
   * @param {string}      method
   * @param {Object|void} params
   *
   * @return {Promise<Object|void>} emitted event
   */
  emitEvent(method, params) {
    return co(function * () {
      yield this.ready;
      const event = yield this._eventHandler(method, params);
      if (event != null) this.emit('event', event);
      return event;
    }.bind(this));
  }

  /**
   * Close the backend connection
   *
   * @return {Promise<void>} callback when connection closed
   */
  close() {
    if (!this._conn) return Promise.resolve();
    return co(function * () {
      if (this._conn.writable) {
        this.request('disconnect').catch(() => {});
      }
      this._conn.end();
      this._conn = null;
    }.bind(this));
  }

  /**
   * Send command to backend
   *
   * @private
   *
   * @param {string} command Command of the request
   * @param {Object} args    Arguments of the request
   *
   * @return {Promise<Object>} response of the request
   */
  _sendRequest(command, args) {
    return co(function * () {
      yield this.connected;

      // v8 will truncate strings in response by default
      if (args && args.maxStringLength == null) {
        args.maxStringLength = -1;
      }

      const seq = this._reqSeq++;
      const msg = { seq, command, type: 'request', arguments: args };
      const json = JSON.stringify(msg);

      this.emit('send', json);
      this._conn.write(
        `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`
      );

      const res = yield new Promise((resolve, reject) => {
        this._callbacks[seq] = { resolve, reject };
      });

      if (res.refs) {
        res.body.refs = {};
        res.refs.forEach(ref => res.body.refs[ref.handle] = ref);
      }

      return res.body;
    }.bind(this));
  }

  /**
   * Handle backend message
   *
   * @private
   *
   * @param {Object} msg Backend message object
   */
  _handleMsg(msg) {
    Promise.resolve().then(() => {
      const body = msg.body;

      // The first message yields connected state
      this.connected.resolve();
      this.emit('message', body);

      const callback = this._callbacks[body.request_seq];

      if (body.type === 'response' && callback) {
        this._callbacks[body.request_seq] = null;
        if (body.success) {
          callback.resolve(body);
        } else {
          callback.reject(body);
        }
        return;
      }

      if (body.type === 'event') {
        return this.emitEvent(body.event, body.body);
      }

      this.emit('unhndledMessage', msg);
    }).catch(error => this.emit('error', error));
  }

  /**
   * Handle backend connection error
   *
   * @private
   *
   * @param {Error} error Connection error object
   */
  _handleError(error) {
    this.emit('error', error);
  }

  /**
   * Handle backend end event
   *
   * @private
   */
  _handleEnd() {
    this.emit('end');
    this.close();
  }

  /**
   * Handle backend connection close
   *
   * @private
   */
  _handleClose() {
    const error = new Error('Connection closed');
    for (const seq of Object.keys(this._callbacks)) {
      if (this._callbacks[seq]) {
        this._callbacks[seq].reject(error);
      }
    }
    this._conn = null;
    this._callbacks = {};
    this.emit('close');
  }
}

module.exports = Backend;
