'use strict';

const co = require('co');
const format = require('util').format;
const bind = require('./util').bind;
const defer = require('./util').defer;

/**
 * @class Frontend
 */
class Frontend extends require('./Extensible') {

  /**
   * @param {WebSocket} conn
   * @param {Backend} backend
   * @param {Object} config
   */
  constructor(conn, backend, config) {
    super(
      (method, params) => this.backend.request(method, params),
      (method, params) => ({ method, params })
    );

    this.backend = backend;
    this.config = config;

    this._conn = conn;

    conn.on('message', this._handleConnMsg.bind(this));
    conn.on('error', this._handleConnError.bind(this));
    conn.once('close', this._handleConnClose.bind(this));

    this.once('close', bind(backend, {
      error: this._notifyBackendError,
      event: this._notifyBackendEvent,
      close: this._handleBackendClose
    }, this));

    this.ready = backend.ready.then(() => {
      backend.emit('frontend', this);
    }).catch(error => {
      this._sendLog('error', error);
    });
  }

  /**
   * Emit an event that will not process by event handler
   *
   * @param {string}      method
   * @param {Object|void} params
   *
   * @return {Promise<void>}
   */
  emitNativeEvent(method, params) {
    return this._send({ method, params });
  }

  /**
   * Close frontend connection
   *
   * @return {Promise<void>} callback when connection closed
   */
  close() {
    if (!this._conn) return Promise.resolve();
    return co(function * () {
      yield this.emitEvent('Inspector.detached');
      this._conn.close();
    }.bind(this));
  }

  /**
   * Handle message from frontend connection
   *
   * @private
   *
   * @param {string} data Message data
   */
  _handleConnMsg(data) {
    co(function * () {

      const msg = JSON.parse(data);

      this.emit('message', msg);

      try {
        yield this.ready;
        const result = yield this.request(msg.method, msg.params);
        if (result != null) yield this._send({ id: msg.id, result });
      } catch (error) {
        yield this._send({ error, id: msg.id });
        this._sendLog('error', msg.method, error);
      }

    }.bind(this)).catch(error => {

      this._sendLog('error', error);
    });
  }

  /**
   * Handle error from frontend connection
   *
   * @private
   *
   * @param {Error} error
   */
  _handleConnError(error) {
    this._sendLog('error', 'NodeInspector Connection:', error);
  }

  /**
   * Handle frontend connection close event
   *
   * @private
   *
   * @param {number} code
   * @param {any}    msg
   */
  _handleConnClose(code, msg) {
    this._conn = null;
    this.emit('close', code, msg);
  }

  /**
   * Notify backend error
   *
   * @private
   *
   * @param {Error} error
   */
  _notifyBackendError(error) {
    this._sendLog('error', 'NodeInspector Backend:', error);
  }

  /**
   * Pass through event from backend
   *
   * @private
   *
   * @param {Object} event Backend event object
   */
  _notifyBackendEvent(event) {
    this.emitEvent(event.method, event.params).catch(error => {
      this._sendLog('error', error);
    });
  }

  /**
   * Notify backend close event
   *
   * @private
   */
  _handleBackendClose() {
    this._sendLog('log', 'Backend closed');
    this.close();
  }

  /**
   * Send message to frontend connection
   *
   * @private
   *
   * @param {Object} msg Message to be sent
   *
   * @return {Promise<void>} callback when sent
   */
  _send(msg) {
    return Promise.resolve().then(() => {
      const data = JSON.stringify(msg, (k, v) => {
        if (!(v instanceof Error)) {
          return v;
        }
        return {
          type: 'object',
          subtype: 'error',
          className: 'Error',
          description: v.stack || v.message || v
        };
      });
      this.emit('send', data);
      this._conn.send(data);
    });
  }

  /**
   * Send log message to frontend console
   *
   * @private
   *
   * @param {string} level   Log level of the message
   * @param {...any} payload Message content
   */
  _sendLog(level/*, ...payload*/) {
    return this.emitEvent('Console.messageAdded', {
      message: {
        level,
        url: 'frontend', line: 0, column: 0,
        repeatCount: 0,
        timestamp: Date.now(),
        parameters: [].slice.call(arguments, 1).map(v => {
          if (v instanceof Error) {
            return v;
          }
          return { type: 'string', value: format(v) };
        })
      }
    }).catch(error => {
      this.emit('error', error);
    });
  }
}

module.exports = Frontend;

