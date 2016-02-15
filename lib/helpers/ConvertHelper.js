'use strict';

const path = require('path');

exports.convert = {

  scriptName: name => (name || '').replace(/\\/g, '/'),

  scriptIsInternal: name => !path.isAbsolute(name),

  location(loc) {
    return {
      scriptId: loc.script_id.toString(),
      lineNumber: loc.line,
      columnNumber: loc.column
    };
  },

  url2path(url) {
    if (url.startsWith('node:///')) {
      return url.slice('node:///'.length);
    }
    return url.slice('file://'.length);
  },

  path2url(name_) {
    const name = this.scriptName(name_);
    if (!this.scriptIsInternal(name)) {
      return 'file://' + name;
    }
    return 'node:///' + name;
  }
};
