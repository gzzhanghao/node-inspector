'use strict';

const co = require('co');
const net = require('net');
const EventEmitter = require('events');
const inherits = require('util').inherits;
const Protocol = require('_debugger').Protocol;
const CallbackManager = require('./CallbackManager');
const ScriptManager = require('./ScriptManager');
const resolve = require.resolve.bind(require);

class DebuggerClient extends EventEmitter {

  constructor(config) {
    super();

    const protocol = new Protocol;
    const conn = net.createConnection(config.debuggerPort);
    
    protocol.onResponse = this._onConnMsg.bind(this);
    conn.on('connect', this._onConnOpen.bind(this));
    conn.on('close', this._onConnClose.bind(this));
    conn.on('error', this._onConnError.bind(this));
    conn.on('data', protocol.execute.bind(protocol));
    conn.setEncoding('utf8');

    this.once('connect', this._onConnConnect.bind(this));

    this.status = {};
    this.closed = false;
    this._config = config;
    this._conn = conn;

    this.scriptManager = new ScriptManager(config);
    this._callbackManager = new CallbackManager;

    this.connected = new Promise((resolve, reject) => {
      this._connectedResolver = { resolve, reject };
    });

    this.ready = new Promise((resolve, reject) => {
      this._readyResolver = { resolve, reject };
    });
  }

  evalGlobal(expression, opts) {
    return this._request('evaluate', Object.assign({ expression, global: true }, opts));
  }

  close() {
    if (!this._conn) return Promise.resolve();
    return co(function * () {
      yield this._request('disconnect').catch(this.emit.bind(this, 'error'));
      yield new Promise(resolve => this._conn.once('close', resolve).end());
    }.bind(this));
  }

  request(command, args) {
    return co(function * () {
      yield this.ready;
      return yield this._request(command, args);
    }.bind(this));
  }
  
  send(msg) {
    return co(function * () {
      yield this.connected;
      const json = JSON.stringify(msg);
      this.emit('send', json);
      const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
      this._conn.write(data);
    }.bind(this));
  }

  _request(command, args) {
    return co(function * () {
      yield this.connected;
      if (args && args.maxStringLength == null) {
        args.maxStringLength = -1;
      }
      const promise = this._callbackManager.promise();
      yield this.send({ command, seq: promise.seq, type: 'request', arguments: args });
      const res = yield promise;
      const body = res.body;
      if (res.refs) {
        body.refs = {};
        res.refs.forEach(ref => {
          body.refs[ref.handle] = ref;
        });
      }
      return body;
    }.bind(this));
  }

  _rejectState(error) {
    this.connected = Promise.reject(error);
    this.ready = Promise.reject(error);
    this._connectedResolver.reject(error);
    this._readyResolver.reject(error);
  }

  _onConnOpen() {
    this.emit('open');
  }
  
  _onConnClose(errored) {
    this._rejectState(new Error('Connection closed'));
    this._conn = null;
    this.closed = true;
    this.emit('close', errored && this._lastError);
  }
  
  _onConnError(error) {
    this._rejectState(error);
    this._lastError = error;
    this.emit('error', error);
  }
  
  _onConnMsg(msg) {
    this.emit('message', msg);
    if (msg.headers.Type === 'connect') {
      this.emit('connect');
    }
    const body = msg.body;
    if (typeof body.running === 'boolean') {
      this.running = body.running;
    }
    if (body.type === 'response' && body.request_seq > 0 && this._callbackManager.handle(body)) {
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

  _onConnConnect() {
    co(function * () {
      this._connectedResolver.resolve();
      const running = this.running;
      if (running) {
        yield this._request('suspend');
      }
      const func = yield this.evalGlobal(`Object.getOwnPropertyDescriptor(global, 'console').get`);
      const scope = yield this._request('scope', { functionHandle: func.handle });
      const NM = scope.refs[scope.object.ref].properties.filter(prop => prop.name === 'NativeModule')[0];
      if (!NM) {
        throw new Error('No NativeModule in target scope');
      }
      const injectorServerPath = JSON.stringify(resolve('./InjectorServer'));
      const options = JSON.stringify({
        injections: this._config.plugins.map(v => v.injection).filter(v => v),
        'v8-debug': resolve('v8-debug'),
        'convert': resolve('./convert')
      });
      this._server = yield this.evalGlobal(
        `NM.require('module')._load(${injectorServerPath}).inject(${options})`,
        { additional_context: [{ name: 'NM', handle: NM.ref }] }
      );
      if (running) {
        yield this._request('Debugger.resume');
      } else {
        yield this._request('Debugger.restartFrame', { callFrameId: 0 });
        yield this._request('continue', { stepaction: 'in' });
      }
      const env = yield this.evalGlobal(`JSON.stringify({
        pid: process.pid,
        cwd: process.cwd(),
        filename: process.mainModule ? process.mainModule.filename : process.argv[1],
        nodeVersion: process.version
      })`);
      this.environment = JSON.parse(env.value);
      this._readyResolver.resolve();
      this.emit('ready');
    }.bind(this)).catch(this.emit.bind(this, 'error'));
  }
}

module.exports = DebuggerClient;
