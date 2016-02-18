'use strict';

const co = require('co');

module.exports = {

  name: 'NodeInspector.TransactionHelper',

  inject(backend) {

    let current = Promise.resolve();
    const pending = [];

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

    return transaction => {
      return current = Promise.all(pending.slice()).then(
        () => transaction(request)
      );
    };
  }
};
