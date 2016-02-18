'use strict';

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

const homePath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
const configPath = process.env.NODE_INSPECTOR_CONFIG;

const defs = {

  'help': {
    alias: 'h',
    type: 'boolean',
    description: 'Display information about avaible options.',
    usage: '--help'
  },

  'version': {
    alias: 'v',
    type: 'boolean',
    description: 'Display Node Inspector\'s version.',
    usage: '--version'
  },

  'port': {
    alias: 'p',
    type: 'number',
    description: 'Port to listen on for Node Inspector\'s web interface.',
    usage: {
      '--port 8081': '',
      '-p 8081': ''
    },
    _default: 8080
  },

  'host': {
    type: 'string',
    description: 'Host to listen on for Node Inspector\'s web interface.',
    usage: {
      '--host 127.0.0.1': '',
      '--host www.example.com': '',
    },
    _default: '127.0.0.1'
  },

  'debug-port': {
    alias: 'd',
    type: 'number',
    description: 'Node/V8 debugger port (`node --debug={port}`).',
    _default: 5858
  },

  'debugHost': {
    type: 'string',
    description: 'Node/V8 debugger host',
    _default: '127.0.0.1'
  },

  'save-live-edit': {
    alias: 's',
    type: 'boolean',
    description: 'Save live edit changes to disk (update the edited files).',
    usage: '--save-live-edit'
  },

  'stack-trace-limit': {
    type: 'number',
    description: 'Number of stack frames to show on a breakpoint.',
    _default: 50
  },

  'ssl.key': {
    type: 'string',
    description: 'A file containing a valid SSL key.',
    usage: '--ssl.key ./ssl/key.pem --ssl.cert ./ssl/cert.pem'
  },

  'ssl.cert': {
    type: 'string',
    description: 'A file containing a valid SSL certificate.',
    usage: '--ssl.key ./ssl/key.pem --ssl.cert ./ssl/cert.pem'
  },

  'node-opts': {
    type: 'string',
    description: 'Pass NodeJS options to debugged process (`node --option={value}`).',
    usage: '--node-opts "--harmony --random_seed=2"'
  },

  'debug-brk': {
    alias: 'b',
    type: 'boolean',
    description: 'Break on the first line (`node --debug-brk`).'
  },

  'max-backend-listeners': {
    type: 'number',
    description: 'Maximum backend listeners',
    _default: 50
  },

  'config': {
    alias: 'c',
    type: 'string',
    description: 'Specify config file',
    usage: '-c /etc/node-inspector'
  },

  'module': {
    type: 'array',
    description: 'Enable specific module',
    usage: `--module "${JSON.stringify('{name:"name",type:"autostart",path:"path"')}"`,
    _merge: false
  },

  'plugin': {
    type: 'array',
    description: 'Path to plugins',
    usage: '--plugin /etc/node-inspector/plugin',
    _merge: false
  }
};

const defaults = {
  modules: require('../front-end/inspector.json').concat(require('../front-end-node/inspector.json')),
  domains: require('../tools/protocol.json').domains,
  plugins: [
    require('./injector/InjectorAgent'),
    require('./helpers/EvalHelper'),
    require('./helpers/ScriptHelper'),
    require('./helpers/NotifyHelper'),
    require('./helpers/DebugBrkHelper'),
    require('./helpers/ProtocolHelper'),
    require('./helpers/InspectorHelper'),
    require('./helpers/EnvironmentHelper'),
    require('./helpers/TransactionHelper'),
    require('./agents/BaseAgent'),
    require('./agents/Page/PageAgent'),
    require('./agents/Runtime/RuntimeAgent'),
    require('./agents/Console/ConsoleAgent'),
    require('./agents/Debugger/DebuggerAgent')
  ]
};

// @todo reimplement a extensible config class

class Config {

  constructor(data, args) {
    this.data = Object.assign({}, defaults, data || {});
    this.parseArgs(args || process.argv);
    this.loadConfig(this.data.config);
    this.applyDefaults();
  }

  parseArgs(args) {
    const config = yargs.options(defs).parse(args);
    this.mergeOptions(config);

    this.data._ = config._.slice(2);

    for (let module of config.module || []) {
      const json = JSON.parse(module);
      json.type = json.type || 'autostart';
      this.data.modules.push(json);
    }

    for (let plugin of config.plugin || []) {
      this.data.plugins.push(require(path.join(process.cwd(), plugin)));
    }
  }

  loadConfig(path_) {
    let configPath = path_;
    if (!configPath) {
      configPath = this.resolveConfig([
        configPath,
        path.join(process.cwd(), 'nose-inspector.js'),
        path.join(homePath, '.node-inspector'),
        path.join('/etc/node-inspector')
      ]);
    }
    if (configPath) {
      this.addConfig(require(configPath));
    }
  }

  addConfig(config) {
    this.mergeOptions(config);

    this.mergeDomains(config.domains || []);
    this.data.modules.push(...config.modules || []);
    this.data.plugins.push(...config.plugins || []);
  }

  mergeOptions(config) {
    for (let key_ of Object.keys(defs)) {
      if (defs[key_]._merge !== false) {
        const key = this.camelCase(key_).split('.')[0];
        if (config[key] != null) this.data[key] = config[key];
      }
    }
  }

  mergeDomains(domains) {
    for (let domain of domains) {
      const existing = this.data.domains.find(d => d.domain === domain.domain);
      if (!existing) {
        this.data.domains.push(domain);
        continue;
      }
      for (let type of ['type', 'command', 'event']) {
        for (let item of domain[`${type}s`] || []) {
          existing[`${type}s`].push(item);
        }
      }
    }
  }

  resolveConfig(paths) {
    for (let path of paths) {
      if (path) {
        try {
          if (fs.statSync(path).isDirectory()) return path;
        } catch (error) {
          // noop
        }
      }
    }
  }

  applyDefaults() {
    for (let key_ of Object.keys(defs)) {
      if (defs[key_]._merge !== false && defs[key_]._default != null) {
        const key = this.camelCase(key_);
        if (this.data[key] == null) this.data[key] = defs[key_]._default;
      }
    }
  }

  camelCase(v) {
    return v.replace(/\-\w/g, v => v[1].toUpperCase());
  }

  getData() {
    const exists = {};
    const modules = this.data.modules;
    this.data.modules = [];
    for (let i = modules.length - 1; i >= 0; i--) {
      if (!exists[modules[i].name]) {
        exists[modules[i].name] = true;
        this.data.modules.push(modules[i]);
      }
    }
    return this.data;
  }
}

Config.definitions = defs;
Config.defaults = defaults;

module.exports = Config;
