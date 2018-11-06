'use strict';

/**
 * Command module for "init" command
 */

const fs = require('fs');
const path = require('path');

exports.command = 'init <path>';

exports.description = 'create a client-side Mocha setup at <path>';

exports.builder = yargs =>
  yargs.positional('path', {
    type: 'string',
    normalize: true
  });

exports.handler = argv => {
  const dest = argv.path;
  const mkdir = require('mkdirp');
  mkdir.sync(dest);
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'mocha.css'));
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'mocha.js'));
  const tmpl = fs.readFileSync(path.join(__dirname, '..', 'template.html'));
  fs.writeFileSync(path.join(dest, 'mocha.css'), css);
  fs.writeFileSync(path.join(dest, 'mocha.js'), js);
  fs.writeFileSync(path.join(dest, 'tests.js'), '');
  fs.writeFileSync(path.join(dest, 'index.html'), tmpl);
  process.exit();
};
