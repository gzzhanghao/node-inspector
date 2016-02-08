'use strict';

const co = require('co');
const EventEmitter = require('events');
const inherits = require('util').inherits;
const net = require('net');
const Protocol = require('_debugger').Protocol;
const CallbackManager = require('./CallbackManager');
const ScriptManager = require('./ScriptManager');
const resolve = require.resolve.bind(require);

/**
 * @constructor
 * @param {number} debuggerPort
 */
class Debugger extends EventEmitter {

  constructor(config) {
    const protocol = new Protocol;
    const conn = net.createConnection(config.debuggerPort);
    
    protocol.onResponse = this._onConnMsg.bind(this));
    conn.on('connect', this._onConnOpen.bind(this));
    conn.on('close', this._onConnClose.bind(this));
    conn.on('error', this._onConnError.bind(this));
    conn.on('data', protocol.execute.bind(protocol));
    conn.setEncoding('utf8');

    this.scriptManager = new ScriptManager;
    this._callbackManager = new CallbackManager;
    this._config = config;
    this._protocol = protocol;
    this._conn = conn;

    this._connected = new Promise((resolve, reject) => {
      this._connectedResolver = { resolve, reject };
    });

    this._ready = new Promise((resolve, reject) => {
      this._readyResolver = { resolve, reject };
    });

    this._ready.then(this._onConnReady.bind(this));
  }

  _onConnOpen() {
    this._connectedResolver.resolve();
    this.emit('connect');
  }
  
  _onConnClose() {
    this._connectedResolver = Promise.reject(new Error('Connection closed'));
    this._readyResolver = Promise.reject(new Error('Connection closed'));
    this.emit('close');
  }
  
  _onConnError(error) {
    this._connectedResolver.reject();
    this._readyResolver.reject();
    this.emit('error', error);
  }
  
  _onConnMsg(msg) {
    const body = msg.body;
    if (msg.headers.Type === 'connect') {
      this._readyResolver.resolve();
    }
    if (typeof body.running === 'boolean') {
      this.running = body.running;
    }
    if (body.type === 'response' && body.request_seq > 0 && this._callbackManager.handler(body)) {
      return;
    }
    if (body.type === 'event') {
      if (body.event === 'break' || body.event === 'exception') {
        this.running = false;
      }
      return this.emit('event', body);
    }
    this.emit('unhndledMessage', msg);
  }

  _onConnReady() {
    co(function * () {
      const running = this.running;
      if (running) {
        yield this.request('suspend');
      }
      const func = yield this.evalGlobal(`Object.getOwnPropertyDescriptor(global, 'console').get`);
      const scope = yield this.request('scope', { functionHandle: func.handle });
      const NM = scope.refs[scope.object.ref].properties.filter(prop => prop.name === 'NativeModule')[0];
      if (!NM) {
        throw new Error('No NativeModule in target scope');
      }
      const injectorServerPath = JSON.stringify(resolve('./InjectorServer'));
      const injections = {
        [resolve('./injections/DebuggerAgent')]: {
          // @todo
        }
      };
      const options = JSON.stringify({
        injections,
        'v8-debug': resolve('v8-debug'),
        'convert': resolve('./convert')
      }};
      yield this.evalGlobal(
        `NM.require('module')._load(${injectorServerPath}).inject(${options})`,
        { additional_context: [{ name: 'NM', handle: NM }] }
      );
    });
  }

  evalGlobal(expression, opts) {
    return this.request('evaluate', Object.assign({ expression, global: true }, opts));
  }
  
  request(type, args) {
    return co(function * () {
      yield this._ready;
      if (args && args.maxStringLength == null) {
        args.maxStringLength = -1;
      }
      const promise = this._callbackManager.promise();
      this.send(Object.assign({ command, seq: promise.seq, type: 'request' }, args));
      const res = yield promise;
      const body = res.body;
      if (res.refs) {
        body.refs = {};
        res.refs.forEach(ref => {
          body.refs[ref.handle] = ref;
        });
      }
      return body;
    });
  }
  
  send(msg) {
    return co(function * () {
      yield this._ready;
      const json = JSON.stringify(msg);
      const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
      this._conn.write(data);
    });
  }
  
  close() {
    this._conn.close();
  }
}

module.exports = Debugger;

