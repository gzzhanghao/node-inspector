'use strict';

const EventEmitter = require('events');
const format = require('util').format;
const co = require('co');

class FrontendClient extends EventEmitter {

  constructor(conn, config) {
    super();

    conn.on('close', this._onConnClose.bind(this));
    conn.on('error', this._onConnError.bind(this));
    conn.on('message', this._onConnMsg.bind(this));

    this.status = {};
    this.closed = false;
    this._conn = conn;
    this._config = config;
  }

  close() {
    if (!this._conn) return Promise.resolve();
    return co(function * () {
      yield this.send({ method: 'Inspector.detached', params: { reason } }).catch(() => {
        // noop
      });
      this._conn.close();
    }.bind(this));
  }

  sendLog(level, ...payload) {
    return this.send({
      method: 'Console.messageAdded',
      params: {
        message: {
          level,
          text: format(...payload),
          url: '', source: 3, type: 0,
          line: 0, column: 0, groupLevel: 7,
          repeatCount: 1
        }
      }
    });
  }

  send(msg) {
    return co(function * () {
      const data = JSON.stringify(msg, (key, val) => {
        if (val instanceof Error) {
          return val.stack || val.message || val;
        }
        return val;
      });

      this.emit('send', data);
      this._conn.send(data);
    }.bind(this));
  }

  _onConnClose(code, msg) {
    this._conn = null;
    this.closed = true;
    this.emit('close', code, msg);
  }

  _onConnError(error) {
    this.emit('error', error);
  }

  _onConnMsg(data) {
    try {
      this.emit('message', JSON.parse(data));
    } catch (error) {
      this.emit('error', error);
    }
  }
}

module.exports = FrontendClient;
