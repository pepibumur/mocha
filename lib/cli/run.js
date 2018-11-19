'use strict';

const Mocha = require('../mocha');
const chalk = require('chalk');

const {
  list,
  showInterfaces,
  showReporters,
  handleFiles,
  handleRequires,
  validatePlugin,
  runMocha
} = require('./run-helpers');
const debug = require('debug')('mocha:cli:run');
const defaults = require('../mocharc');
const {types, aliases} = require('./run-args');

/**
 * Logical option groups
 * @constant
 */
const GROUPS = {
  FILES: 'File Handling',
  FILTERS: 'Test Filters',
  NODEJS: 'Node.js & V8',
  OUTPUT: 'Reporting & Output',
  RULES: 'Rules & Behavior',
  CONFIG: 'Config Files'
};

const ONE_AND_DONES = {
  'show-all-options': yargs => {
    debug('hidden options:');
    yargs.showHelp();
  },
  interfaces: () => {
    debug('interfaces:');
    showInterfaces();
  },
  reporters: () => {
    debug('reporters:');
    showReporters();
  }
};

exports.ONE_AND_DONE_ARGS = new Set(
  ['help', 'h', 'version', 'V'].concat(Object.keys(ONE_AND_DONES))
);

/**
 * Placeholder value to force config parsing function to run.
 */
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
        group: GROUPS.RULES
      },
      'async-only': {
        description:
          'Require all tests to use a callback (async) or return a Promise',
        group: GROUPS.RULES
      },
      'check-leaks': {
        description: 'Check for global variable leaks',
        group: GROUPS.RULES
      },
      'forbid-only': {
        description: 'Fail if exclusive test(s) encountered',
        group: GROUPS.RULES
      },
      'forbid-pending': {
        description: 'Fail if pending test(s) encountered',
        group: GROUPS.RULES
      },
      'full-trace': {
        description: 'Display full stack traces',
        group: GROUPS.OUTPUT
      },
      'inline-diffs': {
        description:
          'Display actual/expected differences inline within each string',
        group: GROUPS.OUTPUT
      },
      'no-colors': {
        conflicts: ['colors'],
        description: 'Disable color output',
        group: GROUPS.OUTPUT
      },
      'no-timeouts': {
        conflicts: ['timeout'],
        description: 'Disable timeouts',
        group: GROUPS.RULES
      },
      'reporter-options': {
        coerce: opts =>
          opts.reduce((acc, opt) => {
            const pair = opt.split('=');

            if (pair.length > 2 || !pair.length) {
              throw new Error(`invalid reporter option '${opt}'`);
            }

            acc[pair[0]] = pair.length === 2 ? pair[1] : true;
            return acc;
          }, {}),
        description: 'Reporter-specific options (<k=v,[k1=v1,..]>)',
        group: GROUPS.OUTPUT,
        requiresArg: true
      },
      'show-all-options': {
        conflicts: ['reporters', 'interfaces']
      },
      'watch-extensions': {
        default: defaults['watch-extensions'],
        defaultDescription: 'js',
        description:
          'Comma-separated list of extensions to monitor with "--watch"',
        group: GROUPS.FILES,
        requiresArg: true
      },
      bail: {
        description: 'Abort ("bail") after first test failure',
        group: GROUPS.RULES
      },
      colors: {
        conflicts: ['no-colors'],
        description: 'Force-enable color output',
        group: GROUPS.OUTPUT
      },
      config: {
        config: true,
        defaultDescription: '(nearest rc file)',
        description: 'Path to config file',
        group: GROUPS.CONFIG
      },
      delay: {
        description: 'Delay initial execution of root suite',
        group: GROUPS.RULES
      },
      diff: {
        default: true,
        description: 'Show diff on failure',
        group: GROUPS.OUTPUT
      },
      exclude: {
        defaultDescription: '(none)',
        description: 'Ignore file(s) or glob pattern(s)',
        group: GROUPS.FILES,
        requiresArg: true
      },
      exit: {
        description: 'Force Mocha to quit after tests complete',
        group: GROUPS.RULES
      },
      extension: {
        default: defaults.extension,
        defaultDescription: 'js',
        description: 'File extensions to load and/or watch',
        group: GROUPS.FILES,
        requiresArg: true
      },
      fgrep: {
        description: 'Only run tests containing this string',
        group: GROUPS.FILTERS,
        requiresArg: true,
        conflicts: 'grep'
      },
      file: {
        defaultDescription: '(none)',
        description:
          'Specify file(s) to be loaded prior to root suite execution',
        group: GROUPS.FILES,
        normalize: true,
        requiresArg: true
      },
      globals: {
        coerce: list,
        description: 'List of allowed global variables',
        group: GROUPS.RULES,
        requiresArg: true
      },
      grep: {
        coerce: value => (!value ? null : value),
        description: 'Only run tests matching this string or regexp',
        group: GROUPS.FILTERS,
        requiresArg: true,
        conflicts: 'fgrep'
      },
      growl: {
        description: 'Enable Growl notifications',
        group: GROUPS.OUTPUT
      },
      interfaces: {
        description: 'List built-in user interfaces & exit',
        conflicts: ['reporters', 'show-all-options']
      },
      invert: {
        description: 'Inverts --grep and --fgrep matches',
        group: GROUPS.FILTERS
      },
      opts: {
        default: defaults.opts,
        description: 'Path to `mocha.opts`',
        group: GROUPS.CONFIG,
        normalize: true,
        requiresArg: true
      },
      package: {
        description: 'Path to package.json for config',
        group: GROUPS.CONFIG,
        normalize: true,
        requiresArg: true
      },
      recursive: {
        description: 'Look for tests in subdirectories',
        group: GROUPS.FILES
      },
      reporter: {
        default: defaults.reporter,
        description: 'Specify reporter to use',
        group: GROUPS.OUTPUT,
        requiresArg: true
      },
      reporters: {
        description: 'List built-in reporters & exit',
        conflicts: ['interfaces', 'show-all-options']
      },
      require: {
        defaultDescription: '(none)',
        description: 'Require module',
        group: GROUPS.FILES,
        requiresArg: true
      },
      retries: {
        description: 'Retry failed tests this many times',
        group: GROUPS.RULES
      },
      slow: {
        default: defaults.slow,
        description: 'Specify "slow" test threshold (in milliseconds)',
        group: GROUPS.RULES
      },
      sort: {
        description: 'Sort test files',
        group: GROUPS.FILES
      },
      timeout: {
        default: defaults.timeout,
        description: 'Specify test timeout threshold (in milliseconds)',
        group: GROUPS.RULES
      },
      ui: {
        default: defaults.ui,
        description: 'Specify user interface',
        group: GROUPS.RULES,
        requiresArg: true
      },
      watch: {
        description: 'Watch files in the current working directory for changes',
        group: GROUPS.FILES
      }
    })
    .positional('spec', {
      default: ['test/'],
      description: 'One or more files, directories, or globs to test',
      type: 'array'
    })
    .check(argv => {
      // "one-and-dones"; let yargs handle help and version
      Object.keys(ONE_AND_DONES).forEach(opt => {
        if (argv[opt]) {
          ONE_AND_DONES[opt].call(null, yargs);
          process.exit();
        }
      });

      // yargs.implies() isn't flexible enough to handle this
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

      // load requires first, because it can impact "plugin" validation
      handleRequires(argv.require);
      validatePlugin(argv, 'reporter', Mocha.reporters);
      validatePlugin(argv, 'ui', Mocha.interfaces);

      return true;
    })
    .array(types.array)
    .boolean(types.boolean)
    .string(types.string)
    .number(types.number)
    .alias(aliases);

exports.handler = argv => {
  debug('post-yargs config', argv);
  const mocha = new Mocha(argv);
  const files = handleFiles(argv);

  debug('running tests with files', files);
  runMocha(mocha, argv, files);
};
