'use strict';

const co = require('co');
const EventEmitter = require('events');
const format = require('util').format;
const bind = require('./util').bind;

class Frontend extends EventEmitter {

  constructor(conn, backend, config) {
    super();

    this.conn = conn;
    this.backend = backend;
    this.config = config;

    conn.on('message', this._handleConnMsg.bind(this));
    conn.on('error', this._handleConnError.bind(this));
    conn.once('close', this._handleConnClose.bind(this));

    this.once('close', bind(backend, {
      event: this._notifyBackendEvent,
      error: this._notifyBackendError,
      close: this._handleBackendClose
    }, this));

    backend.ref();
  }

  close(reason) {
    if (!this.conn) return Promise.resolve();
    return co(function * () {
      this._send({ method: 'Inspector.detached', params: { reason } }).catch(() => {});
      this.conn.close();
    }.bind(this));
  }

  _handleConnMsg(data) {
    co(function * () {
      
      const msg = JSON.parse(data);
      
      this.emit('message', msg);
      
      try {
        const result = yield this.backend.request(msg.method, msg.params);
        if (result != null) this._send({ result, id: msg.id });
      } catch (error) {
        this._send({ error, id: msg.id });
        this._sendLog('error', error);
      }

    }.bind(this)).catch(error => {

      this._sendLog('error', error);
    });
  }

  _handleConnError(error) {
    this._sendLog('error', 'Connection error', error);
  }

  _handleConnClose(code, msg) {
    this.conn = null;
    this.closed = true;
    this.backend.unref();
    this.emit('close', code, msg);
  }

  _notifyBackendEvent(event) {
    this._send(event);
  }

  _notifyBackendError(error) {
    this._sendLog('error', 'Backend error', error);
  }

  _handleBackendClose() {
    this._sendLog('log', 'Backend closed');
    this.close();
  }

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

  _sendLog(level, ...payload) {
    try {
      this._send({
        method: 'Console.messageAdded',
        params: {
          message: {
            level,
            text: format(...payload),
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

