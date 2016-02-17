'use strict';

const co = require('co');
const EventEmitter = require('events');
const format = require('util').format;
const bind = require('./util').bind;

/**
 * @class Frontend
 */
class Frontend extends EventEmitter {

  /**
   * @param {WebSocket} conn
   * @param {Backend} backend
   * @param {Object} config
   */
  constructor(conn, backend, config) {
    super();

    this.conn = conn;
    this.backend = backend;
    this.config = config;

    conn.on('message', this._handleConnMsg.bind(this));
    conn.on('error', this._handleConnError.bind(this));
    conn.once('close', this._handleConnClose.bind(this));

    backend.ready.then(this._notifyPluginError.bind(this));

    this.once('close', bind(backend, {
      event: this._notifyBackendEvent,
      error: this._notifyBackendError,
      close: this._handleBackendClose
    }, this));
  }

  /**
   * Close frontend connection
   *
   * @param {string} reason
   *
   * @return {Promise<void>} callback when connection closed
   */
  close(reason) {
    if (!this.conn) return Promise.resolve();
    return co(function * () {
      this._send({ method: 'Inspector.detached', params: { reason } });
      this.conn.close();
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
        yield this.backend.ready;
        const result = yield Promise.resolve(
          this.backend.request(msg.method, msg.params)
        );
        if (result != null) this._send({ result, id: msg.id });
      } catch (error) {
        this._send({ error, id: msg.id });
        this._sendLog('error', error);
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
    this._sendLog('error', 'Connection error', error);
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
    this.conn = null;
    this.closed = true;
    this.emit('close', code, msg);
  }

  /**
   * Send plugin errors to fronend
   *
   * @private
   *
   * @param {Array<Error>} errors Array of plugin errors
   */
  _notifyPluginError(errors) {
    for (const error of errors) {
      this._sendLog('error', error);
    }
  }

  /**
   * Pass through event from backend
   *
   * @private
   *
   * @param {Object} event Backend event object
   */
  _notifyBackendEvent(event) {
    try {
      this._send(event);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Notify backend error
   *
   * @private
   *
   * @param {Error} error
   */
  _notifyBackendError(error) {
    this._sendLog('error', 'Backend error', error);
  }

  /**
   * Notify backend close event
   *
   * @private
   */
  _handleBackendClose() {
    this._sendLog('log', 'Backend closed');
    try {
      this._send({ method: 'Inspector.detached', params: { } });
    } catch (error) {
      // noop
    }
    this.close();
  }

  /**
   * Send message to frontend connection
   *
   * @private
   *
   * @param {Object} msg Message to be sent
   */
  _send(msg) {
    const data = JSON.stringify(msg, (key, val) => {
      if (val instanceof Error) {
        return val.stack || val.message || val;
      }
      return val;
    });

    this.emit('send', data);
    this.conn.send(data);
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
    try {
      this._send({
        method: 'Console.messageAdded',
        params: {
          message: {
            level,
            text: format.apply(null, [].slice.call(arguments, 1)),
            url: ' ', source: 3, type: 0,
            line: 0, column: 0, groupLevel: 7,
            repeatCount: 1
          }
        }
      });
    } catch (error) {
      this.emit('error', error);
    }
  }
}

module.exports = Frontend;

