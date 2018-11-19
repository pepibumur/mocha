'use strict';

exports.types = {
  array: [
    'exclude',
    'extension',
    'file',
    'globals',
    'require',
    'reporter-options',
    'spec',
    'watch-extensions'
  ],
  boolean: [
    'allow-uncaught',
    'async-only',
    'bail',
    'check-leaks',
    'colors',
    'diff',
    'exit',
    'forbid-only',
    'forbid-pending',
    'full-trace',
    'growl',
    'inline-diffs',
    'invert',
    'no-colors',
    'recursive',
    'watch'
  ],
  number: ['retries', 'slow', 'timeout'],
  string: ['fgrep', 'grep', 'package', 'reporter', 'ui']
};

exports.aliases = {
  'async-only': 'A',
  'no-colors': 'C',
  'reporter-options': 'O',
  bail: 'b',
  colors: 'c',
  fgrep: 'f',
  grep: 'g',
  growl: 'G',
  invert: 'i',
  reporter: 'R',
  require: 'r',
  slow: 's',
  sort: 'S',
  timeout: ['t', 'timeouts'],
  ui: 'u',
  watch: 'w'
};
