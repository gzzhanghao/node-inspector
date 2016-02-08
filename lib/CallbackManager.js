class CallbackManager {

  constructor() {
    this.store = {};
    this.nextCallbackId = 1;
  }

  promise() {
    const seq = this.nextCallbackId++;
    const promise = new Promise((resolve, reject) => {
      this.store[seq] = { resolve, reject };
    });
    promise.seq = seq;
    return promise;
  }

  handle(res) {
    const promise = this.store[res.request_seq];
    if (!promise) return false;
    if (res.success) {
      promise.resolve(res);
    } else {
      promise.reject(res.message);
    }
    this.store[res.request_seq] = null;
    return true;
  }

  clear(error) {
    Object.keys(this.store).forEach(key => this.store[key].reject(error));
    this.store = {};
  }
}

module.exports = CallbackManager;

