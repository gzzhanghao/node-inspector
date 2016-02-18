'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.TransactionHelper',

  inject(backend) {

    /**
     * @type {Promise<any>} current Current transaction lock
     */
    let current = Promise.resolve();

    /**
     * @type {Array<Promise>} pending Pending requests
     */
    let pending = [];

    /**
     * Block requests if there are a pending / executing transaction
     */
    backend.handleCommands((type, args, orig) => {
      if (type === 'NodeInspector.Transaction') {
        return orig(args.type, args.args);
      }
      const req = current.then(() => orig(type, args));
      const remove = () => pending.splice(pending.indexOf(req), 1);
      pending.push(req);
      req.then(remove, remove);
      return req;
    });

    const request = (type, args) => backend.request(
      'NodeInspector.Transaction',
      { type, args }
    );

    /**
     * Start a transaction
     *
     * @param {Function} transaction
     *
     * @return {Promise<any>}
     */
    return transaction => {
      current = Promise.all(pending).then(
        () => transaction(request)
      );
      pending = [];
      return current;
    };
  }
};
