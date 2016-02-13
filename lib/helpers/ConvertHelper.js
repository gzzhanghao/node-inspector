'use strict';

const path = require('path');

const helper = exports.convert = {

  location: loc => ({
    scriptId: loc.script_id.toString(),
    lineNumber: loc.line,
    columnNumber: loc.column
  }),

  script: script => {
    const name = (script.name || '').replace(/\\/g, '/');
    const internal = !path.isAbsolute(name);

    return {
      name, internal,
      scriptId: script.id.toString(),
      url: helper.path2url(name, internal),
      startLine: script.lineOffset,
      startColumn: script.columnOffset
    };
  },

  url2path: url => {
    if (url.startsWith('file://internal/')) {
      return url.slice('file://internal/'.length);
    }
    return url.slice('file://'.length);
  },

  path2url: (path, internal) => {
    let prefix = 'file://';
    if (internal) prefix += 'internal/';
    return prefix + path.replace(/\\/g, '/');
  }
};
