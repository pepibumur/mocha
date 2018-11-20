'use strict';

const fs = require('fs');
const yargsParser = require('yargs-parser');
const {types, aliases} = require('./run-args');
const {ONE_AND_DONE_ARGS} = require('./run');
const mocharc = require('../mocharc.json');
const yargsParserConfig = require('../../package.json').yargs;
const {list} = require('./run-helpers');
const {loadConfig, findConfig} = require('./config');
const findup = require('findup-sync');
const {deprecate} = require('../utils');

const debug = require('debug')('mocha:cli:options');

const configuration = Object.assign({}, yargsParserConfig, {
  'camel-case-expansion': false
});

const coerceOpts = types.array.reduce((acc, arg) => {
  acc[arg] = v => Array.from(new Set(list(v)));
  return acc;
}, {});

const nargOpts = types.array
  .concat(types.string, types.number)
  .reduce((acc, arg) => {
    acc[arg] = 1;
    return acc;
  }, {});

const parse = (args = [], ...configObjects) =>
  yargsParser(
    args,
    Object.assign(
      {
        configuration,
        configObjects,
        coerce: coerceOpts,
        narg: nargOpts,
        alias: aliases
      },
      types
    )
  );

module.exports = getOptions;

/**
 * Parses options read from run-control file.
 *
 * @private
 * @param {string} content - Content read from run-control file.
 * @returns {string[]} cmdline options (and associated arguments)
 */
function parseMochaOpts(content) {
  /*
   * Replaces comments with empty strings
   * Replaces escaped spaces (e.g., 'xxx\ yyy') with HTML space
   * Splits on whitespace, creating array of substrings
   * Filters empty string elements from array
   * Replaces any HTML space with space
   */
  return content
    .replace(/^#.*$/gm, '')
    .replace(/\\\s/g, '%20')
    .split(/\s/)
    .filter(Boolean)
    .map(value => value.replace(/%20/g, ' '));
}

const loadMochaOpts = (exports.loadMochaOpts = (args = {}) => {
  let result;
  let filepath = args.opts;
  // /dev/null is backwards compat
  if (filepath === false || filepath === '/dev/null') {
    return result;
  }
  filepath = filepath || mocharc.opts;
  result = {};
  let mochaOpts;
  try {
    mochaOpts = fs.readFileSync(filepath, 'utf8');
    debug(`read ${filepath}`);
  } catch (err) {
    if (args.opts) {
      throw new Error(`Unable to read ${filepath}: ${err}`);
    }
    // ignore otherwise.  we tried
    debug(`no mocha.opts found at ${filepath}`);
  }

  // real args should override `mocha.opts` which should override defaults.
  // if there's an exception to catch here, I'm not sure what it is.
  // by attaching the `no-opts` arg, we avoid re-parsing of `mocha.opts`.
  if (mochaOpts) {
    result = parse(parseMochaOpts(mochaOpts));
    debug(`${filepath} parsed succesfully`);
  }
  return result;
});

const loadRc = (exports.loadRc = (args = {}) =>
  args.config === false
    ? void 0
    : Object.assign(loadConfig(args.config ? args.config : findConfig())));

const loadPkgRc = (exports.loadPkgRc = (args = {}) => {
  let result;
  if (args.package === false) {
    return result;
  }
  result = {};
  const filepath = args.package || findup(mocharc.package);
  if (filepath) {
    try {
      const pkg = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      if (pkg.mocha) {
        debug(`'mocha' prop of package.json parsed:`, pkg.mocha);
        result = pkg.mocha;
      } else {
        debug(`no config found in ${filepath}`);
      }
    } catch (err) {
      if (args.package) {
        throw new Error(`Unable to read/parse ${filepath}: ${err}`);
      }
      debug(`failed to read default package.json at ${filepath}; ignoring`);
    }
  }
  return result;
});

/**
 * Parses options read from `mocha.opts`, `.mocharc.*` and `package.json`.  Priority list:
 *
 * 1. Command-line args
 * 2. RC file (`.mocharc.js`, `.mocharc.ya?ml`, `mocharc.json`)
 * 3. `mocha` prop of `package.json`
 * 4. `mocha.opts`
 * 5. default rc
 *
 * @param {string|string[]} [argv] - Arguments to parse
 * @returns {yargsParser.Arguments} Parsed args from everything
 */
module.exports.loadOptions = (argv = []) => {
  let args = parse(argv);
  // short-circuit: look for a flag that would abort loading of mocha.opts
  if (
    Array.from(ONE_AND_DONE_ARGS).reduce(
      (acc, arg) => acc || arg in args,
      false
    )
  ) {
    return args;
  }

  const rcConfig = loadRc(args);
  const pkgConfig = loadPkgRc(args);
  const optsConfig = loadMochaOpts(args);

  if (rcConfig) {
    args.config = false;
  }
  if (pkgConfig) {
    args.package = false;
  }
  if (optsConfig) {
    args.opts = false;
  }
  return parse(
    args._,
    args,
    rcConfig || {},
    pkgConfig || {},
    optsConfig || {},
    mocharc
  );
};

/**
 * Prepends options from run-control file to the command line arguments.
 *
 * @deprecated
 * @public
 * @see {@link https://mochajs.org/#mochaopts|mocha.opts}
 */
function getOptions() {
  deprecate(
    'getOptions() is DEPRECATED and will be removed from a future version of Mocha.  Use loadOptions() instead'
  );
  if (
    process.argv.length === 3 &&
    [
      '--help',
      '-h',
      '--version',
      '-V',
      '--reporters',
      '--interfaces',
      '--show-all-options'
    ].indexOf(process.argv[2]) >= 0
  ) {
    return;
  }

  const optsPath =
    process.argv.indexOf('--opts') === -1
      ? mocharc.opts
      : process.argv[process.argv.indexOf('--opts') + 1];

  try {
    const options = parseMochaOpts(fs.readFileSync(optsPath, 'utf8'));

    process.argv = process.argv
      .slice(0, 2)
      .concat(options.concat(process.argv.slice(2)));
  } catch (ignore) {
    // NOTE: should console.error() and throw the error
  }

  process.env.LOADED_MOCHA_OPTS = true;
}
