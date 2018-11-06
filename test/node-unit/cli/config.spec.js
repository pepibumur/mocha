'use strict';

const {loadConfig, parsers} = require('../../../lib/cli/config');
const sinon = require('sinon');

describe('cli/config', function() {
  let sandbox;
  const config = {ok: true};

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('loadConfig()', function() {
    describe('when parsing succeeds', function() {
      beforeEach(function() {
        sandbox.stub(parsers, 'yaml').returns(config);
        sandbox.stub(parsers, 'json').returns(config);
        sandbox.stub(parsers, 'js').returns(config);
      });

      describe('when supplied a filepath with .yaml extension', function() {
        const filepath = 'foo.yaml';

        it('should use the YAML parser', function() {
          loadConfig(filepath);
          expect(parsers.yaml, 'to have calls satisfying', [
            {args: [filepath], returned: config}
          ]).and('was called times', 1);
        });
      });

      describe('when supplied a filepath with .yml extension', function() {
        const filepath = 'foo.yml';

        it('should use the YAML parser', function() {
          loadConfig(filepath);
          expect(parsers.yaml, 'to have calls satisfying', [
            {args: [filepath], returned: config}
          ]).and('was called times', 1);
        });
      });

      describe('when supplied a filepath with .js extension', function() {
        const filepath = 'foo.js';

        it('should use the JS parser', function() {
          loadConfig(filepath);
          expect(parsers.js, 'to have calls satisfying', [
            {args: [filepath], returned: config}
          ]).and('was called times', 1);
        });
      });

      describe('when supplied a filepath with .json extension', function() {
        const filepath = 'foo.json';

        it('should use the JSON parser', function() {
          loadConfig('foo.json');
          expect(parsers.json, 'to have calls satisfying', [
            {args: [filepath], returned: config}
          ]).and('was called times', 1);
        });
      });
    });

    describe('when supplied a filepath with unsupported extension', function() {
      it('should ignore', function() {
        expect(() => loadConfig('foo.bar'), 'not to throw');
      });
    });

    describe('when config file parsing fails', function() {
      beforeEach(function() {
        sandbox.stub(parsers, 'yaml').throws();
      });

      it('should eat the error', function() {
        expect(() => loadConfig('goo.yaml'), 'not to throw');
      });

      it('should return an empty object', function() {
        expect(loadConfig('goo.yaml'), 'to equal', {});
      });
    });
  });
});
