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

/**
 * This is the config pulled from the `yargs` property of Mocha's
 * `package.json`, but it also disables camel case expansion as to
 * avoid outputting non-canonical keynames, as we need to do some
 * lookups.
 * @private
 */
const configuration = Object.assign({}, yargsParserConfig, {
  'camel-case-expansion': false
});

/**
 * This is a really fancy way to ensure unique values for `array`-type
 * options.
 * This is passed as the `coerce` option to `yargs-parser`
 * @private
 */
const coerceOpts = types.array.reduce(
  (acc, arg) => Object.assign(acc, {[arg]: v => Array.from(new Set(list(v)))}),
  {}
);

/**
 * We do not have a case when multiple arguments are ever allowed after a flag
 * (e.g., `--foo bar baz quux`), so we fix the number of arguments to 1 across
 * the board of non-boolean options.
 * This is passed as the `narg` option to `yargs-parser`
 * @private
 */
const nargOpts = types.array
  .concat(types.string, types.number)
  .reduce((acc, arg) => Object.assign(acc, {[arg]: 1}), {});

/**
 * Wrapper around `yargs-parser` which applies our settings
 * @private
 * @param {string|string[]} args - Arguments to parse
 * @param  {...Object} configObjects - `configObjects` for yargs-parser
 */
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

/**
 * Given filepath in `args.opts`, attempt to load and parse a `mocha.opts` file.
 * Return the arguments object.
 * @param {Object} [args] - Arguments object
 * @param {string|boolean} [args.opts] - Filepath to mocha.opts; defaults to
 * whatever's in `mocharc.opts`, or `false` to skip
 * @returns {yargsParser.Arguments|void} If read, object containing parsed arguments
 * @private
 */
const loadMochaOpts = (args = {}) => {
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
    debug(`No mocha.opts found at ${filepath}`);
  }

  // real args should override `mocha.opts` which should override defaults.
  // if there's an exception to catch here, I'm not sure what it is.
  // by attaching the `no-opts` arg, we avoid re-parsing of `mocha.opts`.
  if (mochaOpts) {
    result = parse(parseMochaOpts(mochaOpts));
    debug(`${filepath} parsed succesfully`);
  }
  return result;
};

module.exports.loadMochaOpts = loadMochaOpts;

/**
 * Given path to config file in `args.config`, attempt to load & parse config file.
 * @param {Object} [args] - Arguments object
 * @param {string|boolean} [args.config] - Path to config file or `false` to skip
 * @private
 * @returns {yargsParser.arguments|void} Parsed args if file present
 */
const loadRc = (args = {}) =>
  args.config === false
    ? void 0
    : Object.assign(loadConfig(args.config ? args.config : findConfig()));

module.exports.loadRc = loadRc;

/**
 * Given path to `package.json` in `args.package`, attempt to load config from `mocha` prop.
 * @param {Object} [args] - Arguments object
 * @param {string|boolean} [args.config] - Path to `package.json` or `false` to skip
 * @private
 * @returns {yargsParser.arguments|void} Parsed args if args present
 */
const loadPkgRc = (args = {}) => {
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
};

module.exports.loadPkgRc = loadPkgRc;

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
  if (process.argv.length === 3 && ONE_AND_DONE_ARGS.has(process.argv[2])) {
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
