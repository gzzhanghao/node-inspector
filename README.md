# Node Inspector

__Warning__ This repo is under heavy development and should be considered unstable. Please use [node-inspector/node-inspector](https://github.com/node-inspector/node-inspector) instead if possible.

## Basic usage

Install node-inspector with:

```
npm install -g node-inspector
```

Then you can start inspecting you application:

```
node-debug -- script to be inspect
```

## Usage

### Format

```
node-debug [options] -- [script]
```

### Options

Available options are:

| Option | Alias | Default | Description |
| :------------------ | :-: | :-------: | :-------- |
| --debug-port        | -d  | 5858      | Node/V8 debugger port.<br/>(`node --debug-port=port`)
| --web-host          |     | 127.0.0.1 | Host to listen on for Node Inspector's web interface.
| --web-port          | -p  | 8080      | Port to listen on for Node Inspector's web interface.
| --debug-brk         | -b  | false     | Break on the first line.<br/>(`node --debug-brk`)
| --save-live-edit    | -s  | false     | Save live edit changes to disk (update the edited files).

### Advance usage

You can even inspect node-inspector itself :)

```
node-debug -b -- node-debug -p 8081 -d 5859 -- test-script
```

## Contributing Code

Making Node Inspector the best debugger for node.js cannot be achieved without
the help of the community. The following resources should help you to get
started.

* [Contributing](https://github.com/node-inspector/node-inspector/wiki/Contributing)
* [Developer's Guide](https://github.com/node-inspector/node-inspector/wiki/Developer%27s-Guide)
* [Easy Picks](https://github.com/node-inspector/node-inspector/issues?direction=asc&labels=Easy+Pick&page=1&sort=updated&state=open)

## Credits

Maintainers

 - [Danny Coates](https://github.com/dannycoates) - the original author
   and a sole maintainer for several years.
 - [Miroslav Bajtoš](https://github.com/bajtos) - a current maintainer,
   sponsored by [StrongLoop](http://strongloop.com).
 - [3y3](https://github.com/3y3) - a current maintainer

Big thanks to the many contributors to the project, see [AUTHORS](AUTHORS).
