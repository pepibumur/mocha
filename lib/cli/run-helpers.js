'use strict';

const fs = require('fs');
const debug = require('debug')('mocha:cli:run:helpers');
const Mocha = require('../mocha');
const path = require('path');
const utils = require('../utils');
const minimatch = require('minimatch');
const chalk = require('chalk');
const symbols = require('log-symbols');

const cwd = (exports.cwd = process.cwd());

/**
 * Exits Mocha when tests + code under test has finished execution (default)
 * @param {number} code - Exit code; typically # of failures
 * @private
 */
const exitLater = code => {
  process.on('exit', () => {
    process.exit(Math.min(code, 255));
  });
};

/**
 * Exits Mocha when Mocha itself has finished execution, regardless of
 * what the tests or code under test is doing.
 * @param {number} code - Exit code; typically # of failures
 * @private
 */
const exit = code => {
  const clampedCode = Math.min(code, 255);
  let draining = 0;

  // Eagerly set the process's exit code in case stream.write doesn't
  // execute its callback before the process terminates.
  process.exitCode = clampedCode;

  // flush output for Node.js Windows pipe bug
  // https://github.com/joyent/node/issues/6247 is just one bug example
  // https://github.com/visionmedia/mocha/issues/333 has a good discussion
  const done = () => {
    if (!draining--) {
      process.exit(clampedCode);
    }
  };

  const streams = [process.stdout, process.stderr];

  streams.forEach(stream => {
    // submit empty write request and wait for completion
    draining += 1;
    stream.write('', done);
  });

  done();
};

/**
 * Hide the cursor.
 * @private
 */
const hideCursor = () => {
  process.stdout.write('\u001b[?25l');
};

/**
 * Show the cursor.
 * @private
 */
const showCursor = () => {
  process.stdout.write('\u001b[?25h');
};

/**
 * Stop cursor business
 * @private
 */
const stop = () => {
  process.stdout.write('\u001b[2K');
};

/**
 * Dumps a sorted list of the enumerable, lower-case keys of some object
 * to `STDOUT`.
 * @param {Object} obj - Object, ostensibly having some enumerable keys
 * @private
 */
const showKeys = obj => {
  console.log();
  Object.keys(obj)
    .filter(value => /^[a-z]/.test(value))
    .sort()
    .forEach(key => {
      console.log(`    ${key}`);
    });
  console.log();
};

/**
 * Coerce a comma-delimited string (or array thereof) into a flattened array of
 * strings
 * @param {string|string[]} str - Value to coerce
 * @returns {string[]} Array of strings
 * @private
 */
exports.list = str =>
  Array.isArray(str) ? exports.list(str.join(',')) : (str || '').split(/ *, */);

/**
 * Dump list of built-in interfaces
 * @private
 */
exports.runShowInterfaces = () => {
  showKeys(Mocha.interfaces);
};

/**
 * Dump list of built-in reporters
 * @private
 */
exports.runShowReporters = () => {
  showKeys(Mocha.reporters);
};

/**
 * Process extensions for `--watch`, `--compilers`, etc.
 * @param {yargs.Arguments} argv - Arguments
 * @private
 */
exports.handleExtensions = argv => {
  const compilers = argv.compilers || [];
  if (compilers.length) {
    require('util').deprecate(() => {},
    '"--compilers" will be removed in a future version of Mocha; see https://git.io/vdcSr for more info')();
  }

  argv.extensions = ['js'];
  compilers.forEach(c => {
    const idx = c.indexOf(':');
    const ext = c.slice(0, idx);
    let mod = c.slice(idx + 1);

    if (mod[0] === '.') {
      mod = path.join(cwd, mod);
    }
    require(mod);
    argv.extensions.push(ext);
    argv.watchExtensions.push(ext);
  });
};

/**
 * `require()` the modules as required by `--require <require>`
 * @param {yargs.Arguments} argv - Arguments
 * @private
 */
exports.handleRequires = argv => {
  argv.require.forEach(mod => {
    let modpath = mod;
    if (fs.existsSync(mod, {cwd}) || fs.existsSync(`${mod}.js`, {cwd})) {
      modpath = path.resolve(mod);
      debug(`resolved ${mod} to ${modpath}`);
    }
    require(modpath);
  });
};

/**
 * Smash together an array of test files in the correct order
 * @param {yargs.Arguments} argv - Arguments
 * @returns {string[]} List of files to test
 * @private
 */
exports.handleFiles = argv => {
  let files = [];
  argv.spec.forEach(arg => {
    let newFiles;
    try {
      newFiles = utils.lookupFiles(arg, argv.extensions, argv.recursive);
    } catch (err) {
      if (err.message.indexOf('cannot resolve path') === 0) {
        console.error(
          `Warning: Could not find any test files matching pattern: ${arg}`
        );
        return;
      }

      throw err;
    }

    if (typeof newFiles !== 'undefined') {
      if (typeof newFiles === 'string') {
        newFiles = [newFiles];
      }
      newFiles = newFiles.filter(fileName =>
        (argv.exclude || []).every(pattern => !minimatch(fileName, pattern))
      );
    }

    files = files.concat(newFiles);
  });

  if (!files.length) {
    console.error(chalk.red(`${symbols.error} No test files found`));
    process.exit(1);
  }

  const fileArgs = (argv.file || []).map(filepath => path.resolve(filepath));
  files = files.map(filepath => path.resolve(filepath));

  // ensure we don't sort the stuff from fileArgs; order is important!
  if (argv.sort) {
    files.sort();
  }

  // add files given through --file to be ran first
  files = fileArgs.concat(files);
  debug('files (in order): ', files);
  return files;
};

/**
 * Actually run tests
 * @param {Mocha} mocha - Mocha instance
 * @param {yargs.Arguments} argv - Arguments
 * @param {string[]} files - Array of test files
 * @private
 */
exports.runMocha = (mocha, argv, files) => {
  let runner;

  if (argv.watch) {
    console.log();
    hideCursor();
    process.on('SIGINT', () => {
      showCursor();
      console.log('\n');
      process.exit(130);
    });

    const watchFiles = utils.files(cwd, argv.watchExtensions);
    let runAgain = false;

    const loadAndRun = () => {
      try {
        mocha.files = files;
        runAgain = false;
        runner = mocha.run(() => {
          runner = null;
          if (runAgain) {
            rerun();
          }
        });
      } catch (e) {
        console.log(e.stack);
      }
    };

    const purge = () => {
      watchFiles.forEach(file => {
        delete require.cache[file];
      });
    };

    loadAndRun();

    const rerun = () => {
      purge();
      stop();
      if (!argv.grep) {
        mocha.grep(null);
      }
      mocha.suite = mocha.suite.clone();
      mocha.suite.ctx = new Mocha.Context();
      mocha.ui(argv.ui);
      loadAndRun();
    };

    utils.watch(watchFiles, () => {
      runAgain = true;
      if (runner) {
        runner.abort();
      } else {
        rerun();
      }
    });
  } else {
    // load
    mocha.files = files;
    runner = mocha.run(argv.exit ? exit : exitLater);
  }

  process.on('SIGINT', () => {
    runner.abort();

    // This is a hack:
    // Instead of `process.exit(130)`, set runner.failures to 130 (exit code for SIGINT)
    // The amount of failures will be emitted as error code later
    runner.failures = 130;
  });
};

/**
 * Used for `--reporter` and `--ui`.  Ensures there's only one, and asserts
 * that it actually exists.
 * @todo XXX This must get run after requires are processed, as it'll prevent
 * interfaces from loading.
 * @param {yargs.Arguments} argv - Arguments
 * @param {string} option - Resolvable module name or path
 * @param {Object} map - An object perhaps having key `option`
 * @private
 */
exports.validatePlugin = (argv, option, map) => {
  if (Array.isArray(argv[option])) {
    throw new Error(`"--${option} <${option}>" can only be specified once`);
  }

  if (!map[argv[option]]) {
    try {
      argv[option] = require(argv[option]);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        // Try to load reporters from a path (absolute or relative)
        try {
          argv[option] = require(path.resolve(process.cwd(), argv[option]));
        } catch (err) {
          throw new Error(`unknown ${option} "${argv[option]}"`);
        }
      } else {
        throw new Error(`unknown ${option} "${argv[option]}"`);
      }
    }
  }
};
