'use strict';

const co = require('co');
const EventEmitter = require('events');
const format = require('util').format;

class Frontend extends EventEmitter {

  constructor(conn, config) {
    super();

    this.conn = conn;
    this.config = config;

    conn.on('close', this._onConnClose.bind(this));
    conn.on('error', this._onConnError.bind(this));
    conn.on('message', this._onConnMsg.bind(this));
  }

  close(reason) {
    if (!this.conn) return Promise.resolve();
    return co(function * () {
      yield this.send({ method: 'Inspector.detached', params: { reason } }).catch(() => {});
      this.conn.close();
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
      this.conn.send(data);
    }.bind(this));
  }

  _onConnClose(code, msg) {
    this.conn = null;
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

module.exports = Frontend;
