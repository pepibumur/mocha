'use strict';

/**
 * This is where we finally parse and handle arguments passed to the `mocha`
 * executable.
 *
 * *This is the file you probably wanted four modules ago.*
 */

const debug = require('debug')('mocha:cli:cli');
const symbols = require('log-symbols');
const yargs = require('yargs');
const path = require('path');
const {loadOptions} = require('./options');
const commands = require('./commands');
const chalk = require('chalk');
const {repository, homepage, version, gitter} = require('../../package.json');

exports.main = (argv = process.argv.slice(2)) => {
  debug('entered main with raw args', argv);
  // ensure we can require() from current working directory
  module.paths.push(process.cwd(), path.resolve('node_modules'));

  Error.stackTraceLimit = Infinity; // configurable via --stack-trace-limit?

  yargs
    .scriptName('mocha')
    .command(commands.run)
    .command(commands.init)
    .updateStrings({
      'Positionals:': 'Positional Arguments',
      'Options:': 'Other Options',
      'Commands:': 'Commands'
    })
    .fail((msg, err, yargs) => {
      debug(err);
      yargs.showHelp();
      console.error(`\n${symbols.error} ${chalk.red('ERROR:')} ${msg}`);
      process.exit(1);
    })
    .help('help', 'Show usage information & exit')
    .alias('help', 'h')
    .version('version', 'Show version number & exit', version)
    .alias('version', 'V')
    .wrap(80)
    .epilog(
      `Mocha Resources
    Chat: ${chalk.magenta(gitter)}
  GitHub: ${chalk.blue(repository.url)}
    Docs: ${chalk.yellow(homepage)}
      `
    )
    .parse(argv, loadOptions(argv));
};

// allow direct execution
if (require.main === module) {
  exports.main();
}
