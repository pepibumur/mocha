'use strict';

/**
 * Command module for default ("run") command
 */

const path = require('path');
const {loadConfig, findConfig} = require('./config');
const Mocha = require('../mocha');
const chalk = require('chalk');
const yargs = require('yargs');
const {
  list,
  cwd,
  runShowInterfaces,
  runShowReporters,
  handleFiles,
  handleRequires,
  validatePlugin,
  runMocha
} = require('./run-helpers');
const debug = require('debug')('mocha:cli:run');

/**
 * Logical option groups
 */
const GROUPS = {
  FILES: 'File Handling',
  FILTERS: 'Test Filters',
  NODEJS: 'Node.js & V8',
  OUTPUT: 'Reporting & Output',
  RULES: 'Rules & Behavior',
  CONFIG: 'Config Files'
};

/**
 * Placeholder value to force config parsing function to run.
 */
const CONFIG_PATH_PLACEHOLDER = '__MOCHA_CONFIG_PATH__';

const SHOW_HIDDEN_HELP_OPTION = (exports.SHOW_HIDDEN_HELP_OPTION =
  'show-all-options');

exports.command = '$0 [spec..]';

exports.describe = 'Run tests with Mocha';

exports.builder = yargs =>
  yargs
    .showHidden(
      SHOW_HIDDEN_HELP_OPTION,
      'Show help, including all Node.js/V8 & other hidden options'
    )
    .options({
      'allow-uncaught': {
        description: 'Allow uncaught errors to propagate',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      'async-only': {
        alias: 'A',
        description:
          'Require all tests to use a callback (async) or return a Promise',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      'check-leaks': {
        description: 'Check for global variable leaks',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      'forbid-only': {
        description: 'Fail if exclusive test(s) encountered',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      'forbid-pending': {
        description: 'Fail if pending test(s) encountered',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      'full-trace': {
        description: 'Display full stack traces',
        group: GROUPS.OUTPUT,
        type: 'boolean'
      },
      'inline-diffs': {
        description:
          'Display actual/expected differences inline within each string',
        group: GROUPS.OUTPUT,
        type: 'boolean'
      },
      'no-colors': {
        alias: 'C',
        conflicts: ['colors'],
        description: 'Disable color output',
        group: GROUPS.OUTPUT,
        type: 'boolean'
      },
      'no-timeouts': {
        conflicts: ['timeout'],
        description: 'Disable timeouts',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      'reporter-options': {
        alias: 'O',
        coerce: (opts = '') =>
          opts.split(',').reduce((acc, opt) => {
            const pair = opt.split('=');

            if (pair.length > 2 || !pair.length) {
              throw new Error(`invalid reporter option '${opt}'`);
            }

            acc[pair[0]] = pair.length === 2 ? pair[1] : true;
            return acc;
          }, {}),
        description: 'Reporter-specific options (<k=v,[k1=v1,..]>)',
        group: GROUPS.OUTPUT,
        requiresArg: true,
        type: 'string'
      },
      'watch-extensions': {
        coerce: list,
        default: 'js',
        description:
          'Comma-separated list of extensions to monitor with "--watch"',
        group: GROUPS.FILES,
        requiresArg: true,
        type: 'string'
      },
      bail: {
        alias: 'b',
        description: 'Abort ("bail") after first test failure',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      colors: {
        alias: 'c',
        conflicts: ['no-colors'],
        description: 'Force-enable color output',
        group: GROUPS.OUTPUT,
        type: 'boolean'
      },
      config: {
        config: true,
        default: CONFIG_PATH_PLACEHOLDER,
        defaultDescription: '(nearest rc file)',
        description: 'Load config from file',
        global: false,
        group: GROUPS.CONFIG
      },
      delay: {
        description: 'Delay initial execution of root suite',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      diff: {
        default: true,
        description: 'Show diff on failure',
        group: GROUPS.OUTPUT,
        type: 'boolean'
      },
      exclude: {
        default: [],
        defaultDescription: '(none)',
        description: 'Ignore file(s) or glob pattern(s)',
        group: GROUPS.FILES,
        requiresArg: true,
        type: 'array'
      },
      exit: {
        description: 'Force Mocha to quit after tests complete',
        group: GROUPS.RULES,
        type: 'boolean'
      },
      extension: {
        default: ['js'],
        defaultDescription: 'js',
        description: 'File extensions to load and/or watch',
        group: GROUPS.FILES,
        requiresArg: true,
        type: 'array'
      },
      fgrep: {
        alias: 'f',
        description: 'Only run tests containing this string',
        group: GROUPS.FILTERS,
        requiresArg: true,
        type: 'string'
      },
      file: {
        default: [],
        defaultDescription: '(none)',
        description:
          'Specify file(s) to be loaded prior to root suite execution',
        group: GROUPS.FILES,
        normalize: true,
        requiresArg: true,
        type: 'array'
      },
      globals: {
        coerce: list,
        description: 'Comma-separated list of allowed global variables',
        group: GROUPS.RULES,
        requiresArg: true,
        type: 'string'
      },
      grep: {
        alias: 'g',
        coerce: value => (!value ? null : value),
        description: 'Only run tests matching this string or regexp',
        group: GROUPS.FILTERS,
        requiresArg: true,
        type: 'string'
      },
      growl: {
        alias: 'G',
        description: 'Enable Growl notifications',
        group: GROUPS.OUTPUT,
        type: 'boolean'
      },
      interfaces: {
        description: 'List built-in user interfaces & exit',
        type: 'boolean'
      },
      invert: {
        alias: 'i',
        description: 'Inverts --grep and --fgrep matches',
        group: GROUPS.FILTERS,
        type: 'boolean'
      },
      opts: {
        default: './test/mocha.opts',
        description: 'Path to `mocha.opts`',
        group: GROUPS.CONFIG,
        normalize: true,
        requiresArg: true
      },
      recursive: {
        description: 'Look for tests in subdirectories',
        group: GROUPS.FILES,
        type: 'boolean'
      },
      reporter: {
        alias: 'R',
        default: 'spec',
        description: 'Specify reporter to use',
        group: GROUPS.OUTPUT,
        requiresArg: true,
        type: 'string'
      },
      reporters: {
        description: 'List built-in reporters & exit',
        type: 'boolean'
      },
      require: {
        alias: 'r',
        default: [],
        defaultDescription: '(none)',
        description: 'Require module',
        group: GROUPS.FILES,
        requiresArg: true,
        type: 'array'
      },
      retries: {
        default: 0,
        description: 'Retry failed tests this many times',
        group: GROUPS.RULES,
        type: 'number'
      },
      slow: {
        alias: 's',
        default: 75,
        description: 'Specify "slow" test threshold (in milliseconds)',
        group: GROUPS.RULES,
        type: 'number'
      },
      sort: {
        alias: 'S',
        description: 'Sort test files',
        group: GROUPS.FILES,
        type: 'boolean'
      },
      timeout: {
        alias: 't',
        default: 2000,
        description: 'Specify test timeout threshold (in milliseconds)',
        group: GROUPS.RULES
      },
      ui: {
        alias: 'u',
        default: 'bdd',
        description: 'Specify user interface',
        group: GROUPS.RULES,
        requiresArg: true,
        type: 'string'
      },
      watch: {
        alias: 'w',
        description: 'Watch files in the current working directory for changes',
        group: GROUPS.FILES,
        type: 'boolean'
      }
    })
    .positional('spec', {
      default: ['test/'],
      defaultDescription: 'test',
      description: 'One or more files, directories, or globs to test',
      type: 'array'
    })
    .config('config', 'Load config file', filepath => {
      // yargs normalizes this into an absolute path, which is why
      // this is weird.
      if (filepath === path.resolve(CONFIG_PATH_PLACEHOLDER)) {
        debug(`looking for config from ${cwd}`);
        return findConfig(cwd);
      }
      debug(`loading config at ${filepath}`);
      return loadConfig(filepath);
    })
    .pkgConf('mocha')
    .check(argv => {
      if (argv.invert && !('fgrep' in argv || 'grep' in argv)) {
        throw new Error(
          '"--invert" requires one of "--fgrep <str>" or "--grep <regexp>"'
        );
      }

      if (argv.compilers) {
        throw new Error(
          `--compilers is DEPRECATED and no longer supported.
  See ${chalk.cyan('https://git.io/vdcSr')} for migration information.`
        );
      }

      validatePlugin(argv, 'reporter', Mocha.reporters);
      validatePlugin(argv, 'ui', Mocha.interfaces);

      return true;
    });

exports.handler = argv => {
  debug('post-yargs config', argv);

  // load requires first, because it can impact subsequent operations.
  handleRequires(argv.require);

  if (argv[SHOW_HIDDEN_HELP_OPTION]) {
    debug('hidden options:');
    yargs.showHelp();
    process.exit();
  }

  if (argv.interfaces) {
    debug('interfaces:');
    runShowInterfaces();
    process.exit();
  }

  if (argv.reporters) {
    debug('reporters:');
    runShowReporters();
    process.exit();
  }

  const mocha = new Mocha();

  mocha
    .bail(argv.bail)
    .fgrep(argv.fgrep)
    .globals(argv.globals)
    .grep(argv.grep)
    .reporter(argv.reporter, argv.reporterOptions)
    .retries(argv.retries)
    .slow(argv.slow)
    .timeout(argv.timeout)
    .ui(argv.ui)
    .useColors(argv.colors)
    .useInlineDiffs(argv.inlineDiffs);

  // pesky inverted options
  mocha.hideDiff(!argv.diff).enableTimeouts(!argv.noTimeouts);

  // pain: toggles NOT accepting parameters
  [
    'allowUncaught',
    'asyncOnly',
    'checkLeaks',
    'delay',
    'forbidOnly',
    'forbidPending',
    'fullTrace',
    'growl',
    'invert'
  ].forEach(arg => {
    if (argv[arg]) {
      mocha[arg]();
    }
  });

  const files = handleFiles(argv);
  debug('running with files', files);

  runMocha(mocha, argv, files);
};
