'use strict';

var fs = require('fs');
var path = require('path');

// as of v6.0.0 we no longer use `mocha.opts` by default, which means
// we must provide `--opts` on command line to run this test file
describe('mocha.opts', function() {
  it('should not duplicate mocha.opts args in process.argv', function() {
    var processArgv = process.argv.join('');
    var mochaOpts = fs
      .readFileSync(path.join(__dirname, 'mocha.opts'), 'utf-8')
      .replace(/^#.*$/gm, '')
      .split(/[\s]+/)
      .join('');
    expect(processArgv.indexOf(mochaOpts), 'not to be', -1).and(
      'to be',
      processArgv.lastIndexOf(mochaOpts)
    );
  });
});
