'use strict';

const path = require('path');

const helper = exports.convert = {

  location: loc => ({
    scriptId: loc.script_id.toString(),
    lineNumber: loc.line,
    columnNumber: loc.column
  }),

  script: script => {
    const name = helper.scriptName(script.name);
    const internal = !helper.isInternal(name);

    return {
      name, internal,
      scriptId: script.id.toString(),
      url: helper.path2url(name),
      startLine: script.lineOffset,
      startColumn: script.columnOffset
    };
  },

  scriptName: name => (name || '').replace(/\\/g, '/'),

  isInternal: name => path.isAbsolute(name),

  url2path: url => {
    if (url.startsWith('file://internal/')) {
      return url.slice('file://internal/'.length);
    }
    return url.slice('file://'.length);
  },

  path2url: name_ => {
    const name = helper.scriptName(name_);
    let prefix = 'file://';
    if (!helper.isInternal(name)) prefix += 'internal/';
    return prefix + name.replace(/\\/g, '/');
  }
};
