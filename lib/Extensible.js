'use strict';

const co = require('co');

class Extensible extends require('events') {

  /**
   * @param {Function} commandHandler
   * @param {Function} eventHandler
   */
  constructor(commandHandler, eventHandler) {
    super();
    this._commandHandler = commandHandler;
    this._eventHandler = eventHandler;
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
   * Send request
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
   * Emit event
   *
   * @param {string}      method
   * @param {Object|void} params
   *
   * @return {Promise<Object|void>}
   */
  emitEvent(method, params) {
    return co(function * () {
      yield this.ready;
      const event = yield this._eventHandler(method, params);
      if (event != null) {
        yield this.emitNativeEvent(event.method, event.params);
      }
      return event;
    }.bind(this));
  }
}

module.exports = Extensible;
