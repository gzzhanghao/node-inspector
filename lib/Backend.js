'use strict';

const co = require('co');
const net = require('net');
const EventEmitter = require('events');
const inherits = require('util').inherits;
const Protocol = require('_debugger').Protocol;
const resolve = require.resolve.bind(require);

class Backend extends EventEmitter {

  constructor(config) {
    super();

    const protocol = new Protocol;
    const conn = net.createConnection(config.debuggerPort);

    this.conn = conn;
    this.config = config;
    this.injections = [];

    conn.setEncoding('utf8');
    conn.on('data', protocol.execute.bind(protocol));
    conn.on('error', this._onConnError.bind(this));
    conn.once('close', this._onConnClose.bind(this));

    protocol.onResponse = this._onConnMsg.bind(this);
    this.once('connect', this._onConnConnect.bind(this));

    this._reqSeq = 1;
    this._callbacks = {};

    this._makeStatusPromise('ready');
    this._makeStatusPromise('connected', 'connect');
  }

  close() {
    if (!this.conn) return Promise.resolve();
    return co(function * () {
      yield this._request('disconnect').catch(() => {});
      this.conn.end();
    }.bind(this));
  }

  addInjections(paths) {
    this.injections = this.injections.concat(paths);
  }

  evalGlobal(expression, opts) {
    return this._request('evaluate', Object.assign({ expression, global: true }, opts));
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
      this.conn.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
    }.bind(this));
  }

  _makeStatusPromise(name, event) {
    this[name] = new Promise((resolve, reject_) => {
      this.once(event || name, resolve);

      this.once('close', reject);
      this.once('error', reject);

      function reject(error) {
        this[name] = Promise.reject(error);
        reject_(error);
      }
    });
  }

  _request(command, args) {
    return co(function * () {
      yield this.connected;

      if (args && args.maxStringLength == null) {
        args.maxStringLength = -1;
      }

      const seq = this._reqSeq++;

      yield this.send({ seq, command, type: 'request', arguments: args });

      const res = yield new Promise((resolve, reject) => {
        this._callbacks[seq] = { resolve, reject };
      });

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

  _onConnClose(errored) {
    const error = errored && this._lastError;

    for (let seq of Object.keys(this._callbacks)) {
      if (this._callbacks[seq]) {
        this._callbacks[seq].reject(error);
      }
    }
    
    this.conn = null;
    this._callbacks = {};
    
    this.emit('close', error);
  }
  
  _onConnError(error) {
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

    const callback = this._callbacks[body.request_seq];

    if (body.type === 'response' && body.request_seq > 0 && callback) {

      this._callbacks[body.request_seq] = null;

      if (body.success) {
        callback.resolve(body);
      } else {
        callback.reject(body);
      }
      return;
    }

    if (body.type !== 'event') {
      return this.emit('unhndledMessage', msg);
    }

    if (body.event === 'break' || body.event === 'exception') {
      this.running = false;
    }
    return this.emit('event', body);
  }

  _onConnConnect() {
    co(function * () {

      // Pause if we are running
      const running = this.running;
      if (running) {
        yield this._request('suspend');
      }

      // Get scope of console getter
      const funcExpr = `Object.getOwnPropertyDescriptor(global, 'console').get`;
      const func = yield this.evalGlobal(funcExpr);
      const scope = yield this._request('scope', { functionHandle: func.handle });

      // Find NativeModule object in console getter's scope
      const props = scope.refs[scope.object.ref].properties;
      const NM = props.filter(prop => prop.name === 'NativeModule')[0];
      if (!NM) {
        throw new Error('No NativeModule in target scope');
      }

      // Initialize injector server options
      const injectorServerPath = JSON.stringify(resolve('./InjectorServer'));
      const options = JSON.stringify({
        config: this.config,
        injections: this.injections,
        'v8-debug': resolve('v8-debug'),
        'convert': resolve('./convert')
      });

      // Inject injector server into target process
      this._server = yield this.evalGlobal(
        `NM.require('module')._load(${injectorServerPath}).inject(${options})`,
        { additional_context: [{ name: 'NM', handle: NM.ref }] }
      );

      // Restart the debug context if we were paused
      if (running) {
        yield this._request('Debugger.resume');
      } else {
        yield this._request('Debugger.restartFrame', { callFrameId: 0 });
        yield this._request('continue', { stepaction: 'in' });
      }

      // Resolve environment variables
      const env = yield this.evalGlobal(`JSON.stringify({
        pid: process.pid,
        cwd: process.cwd(),
        filename: process.mainModule ? process.mainModule.filename : process.argv[1],
        nodeVersion: process.version
      })`);
      this.environment = JSON.parse(env.value);

      // Emit ready event
      this.emit('ready');

    }.bind(this)).catch(this.emit.bind(this, 'error'));
  }
}

module.exports = Backend;
