'use strict';

/**
 * This is where we finally parse and handle arguments passed to the `mocha`
 * executable.
 *
 * *This is the file you probably wanted four modules ago.*
 */

const symbols = require('log-symbols');
const yargs = require('yargs');
const path = require('path');
const getOptions = require('./options');
const commands = require('./commands');
const chalk = require('chalk');
const {repository, homepage, version, gitter} = require('../../package.json');

exports.main = () => {
  // ensure we can require() from current working directory
  module.paths.push(process.cwd(), path.resolve('node_modules'));

  // If not already done, load mocha.opts
  if (!process.env.LOADED_MOCHA_OPTS) {
    getOptions();
  }

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
    .parse();
};

// allow direct execution
if (require.main === module) {
  exports.main();
}
