'use strict';

const co = require('co');
const promisify = require('bluebird').promisify;
const fs = require('fs');
const path = require('path');
const writeFile = promisify(fs.writeFile);

class ScriptManager {

  constructor(config) {
    this._config = config;
    this.resources = [];
  }

  reset() {
    this.resources = [];
  }

  addScript(script) {
    if (this.resolveScriptById(script.id)) {
      return null;
    }
    const name = script.name || '';
    const scriptData = {
      name,
      scriptId: script.id + '',
      url: name,
      internal: !path.isAbsolute(name),
      startLine: script.lineOffset,
      startColumn: script.columnOffset
    };
    this.resources.push(scriptData);
    return scriptData;
  }

  resolveScriptById(id) {
    return this.resources.find(script => script.scriptId === id + '');
  }

  resolveScriptByUrl(url) {
    return this.resources.find(script => script.url === url);
  }
}

module.exports = ScriptManager;
