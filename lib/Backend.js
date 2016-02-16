'use strict';

const co = require('co');
const EventEmitter = require('events');
const inherits = require('util').inherits;
const Protocol = require('_debugger').Protocol;
const resolve = require.resolve.bind(require);

class Backend extends EventEmitter {

  constructor(conn, config) {
    super();

    this.conn = conn;
    this.config = config;
    this.injections = [];

    let protocol = new Protocol;

    conn.on('data', data => {
      try {
        protocol.execute(data);
      } catch (error) {
        protocol = new Protocol;
        protocol.onResponse = this._handleMsg.bind(this);
        this.emit('error', error);
      }
    });

    protocol.onResponse = this._handleMsg.bind(this);

    conn.setEncoding('utf8');
    conn.on('error', this._handleError.bind(this));
    conn.once('close', this._handleClose.bind(this));

    this._ref = 0;
    this._reqSeq = 1;
    this._callbacks = {};

    this._events = {};
    this._commands = {};

    this._makeStatusPromise('ready');
    this._makeStatusPromise('connected', 'connect');

    this.setMaxListeners(this.config.maxBackendListeners);

    this.once('connect', this._injectServer.bind(this));

    for (let plugin of config.plugins) {
      if (typeof plugin === 'function') {
        plugin(this);
      } else {
        Object.assign(this, plugin);
      }
    }
  }

  inject(paths) {
    if (typeof paths === 'string') {
      this.injections.push(paths);
    } else {
      this.injections.push(...paths);
    }
  }

  registerEvents(events) {
    Object.assign(this._events, events);
  }

  registerCommands(commands) {
    Object.assign(this._commands, commands);
  }

  request(type, args) {
    return co(function * () {
      yield this.ready;

      const handler = this._commands[type];

      if (handler == null) {
        return yield this._request(type, args);
      } else if (typeof handler !== 'function') {
        return handler;
      }

      return yield Promise.resolve().then(() => handler(args, type));
    }.bind(this));
  }

  emitEvent(method, params) {
    return co(function * () {
      yield this.connected;

      const handler = this._events[method];
      let result = { method, params };

      if (typeof handler === 'function') {
        result = yield handler(params, method);
      }
      if (result != null) {
        this.emit('event', result);
      }
    }.bind(this));
  }

  close() {
    if (!this.conn) return Promise.resolve();
    return co(function * () {
      this._request('disconnect').catch(() => {});
      let listener;
      const closed = yield Promise.race([
        new Promise(resolve => this.conn.once('close', listener = () => resolve(true))),
        new Promise(resolve => setTimeout(resolve, 200))
      ]);
      this.conn.end();
      if (!closed) {
        this.conn.removeListener('close', listener);
        this.conn.destroy();
      }
      this.conn = null;
    }.bind(this));
  }

  environment() {
    if (this._env) return this._env;
    return this._env = co(function * () {
      const env = yield this._evalGlobal(`JSON.stringify({
        pid: process.pid,
        cwd: process.cwd(),
        filename: process.mainModule ? process.mainModule.filename : process.argv[1],
        nodeVersion: process.version
      })`);
      return JSON.parse(env.value);
    }.bind(this));
  }

  running() {
    return co(function * () {
      yield this.environment();
      return this._running;
    }.bind(this));
  }

  ref() {
    this._ref += 1;
  }

  unref() {
    this._ref -= 1;
    if (!this._ref) this.close();
  }

  _request(command, args) {
    return co(function * () {
      yield this.connected;

      if (args && args.maxStringLength == null) {
        args.maxStringLength = -1;
      }

      const seq = this._reqSeq++;
      const json = JSON.stringify({ seq, command, type: 'request', arguments: args });

      this.emit('send', json);
      this.conn.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);

      const res = yield new Promise((resolve, reject) => {
        this._callbacks[seq] = { resolve, reject };
      });

      if (res.refs) {
        res.body.refs = {};
        res.refs.forEach(ref => {
          res.body.refs[ref.handle] = ref;
        });
      }

      return res.body;
    }.bind(this));
  }

  _evalGlobal(expression, opts) {
    return this._request('evaluate', Object.assign({ expression, global: true }, opts));
  }

  _handleClose(errored) {
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
  
  _handleError(error) {
    this._lastError = error;
    this.emit('error', error);
  }
  
  _handleMsg(msg) {
    this.emit('message', msg);

    if (msg.headers.Type === 'connect') {
      this.emit('connect');
    }

    const body = msg.body;

    if (typeof body.running === 'boolean') {
      this._running = body.running;
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
      // occurs when multiple clients connected to a debug process
      return this.emit('unhndledMessage', msg);
    }

    if (body.event === 'break' || body.event === 'exception') {
      this._running = false;
    }
    this.emitEvent(body.event, body.body).catch(error => {
      this.emit('error', error);
    });
  }

  _injectServer() {
    co(function * () {

      // Pause if we are running
      const running = yield this.running();
      if (running) yield this._request('suspend');

      // Get scope of console getter
      const func = yield this._evalGlobal(`Object.getOwnPropertyDescriptor(global, 'console').get`);
      const scope = yield this._request('scope', { functionHandle: func.handle });

      // Find NativeModule object in console getter's scope
      const props = scope.refs[scope.object.ref].properties;
      const NM = props.filter(prop => prop.name === 'NativeModule')[0];
      if (!NM) throw new Error('No NativeModule in target scope');

      // Initialize injector server options
      const injectorServerPath = JSON.stringify(resolve('./InjectorServer'));
      const options = JSON.stringify({
        config: this.config,
        injections: this.injections,
        'v8-debug': resolve('v8-debug')
      });

      // Inject injector server into target process
      const result = yield this._evalGlobal(
        `NM.require('module')._load(${injectorServerPath}).inject(${options})`,
        { additional_context: [{ name: 'NM', handle: NM.ref }] }
      );

      // Restart the debug context if we were paused
      if (running) {
        yield this._request('continue');
      } else if (result.value !== false) {
        yield this._request('Debugger.restartFrame', { callFrameId: 0 });
        yield this._request('continue', { stepaction: 'in' });
      }

      // Emit ready event
      this.emit('ready');

    }.bind(this)).catch(error => {

      this.emit('error', error);
    });
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
}

module.exports = Backend;
