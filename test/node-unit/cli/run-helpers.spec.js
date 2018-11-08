'use strict';

const {validatePlugin} = require('../../../lib/cli/run-helpers');
const {createSandbox} = require('sinon');

describe('cli "run" command', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('helpers', function() {
    describe('validatePlugin()', function() {
      it('should disallow an array of module names', function() {
        expect(
          () => validatePlugin({foo: ['bar']}, 'foo'),
          'to throw',
          TypeError
        );
      });
    });
  });
});
