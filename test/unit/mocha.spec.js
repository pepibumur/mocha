'use strict';

var Mocha = require('../../lib/mocha');
var Test = Mocha.Test;

describe('Mocha', function() {
  var opts = {reporter: function() {}}; // no output

  describe('.run(fn)', function() {
    it('should not raise errors if callback was not provided', function(done) {
      var mocha = new Mocha(opts);
      var runner;
      // we must end this test when it's actually done, or Bad Weirdness can occur
      // w/r/t delayed root suite
      expect(function() {
        runner = mocha.run();
      }, 'not to throw');
      runner.on('end', done);
    });

    it('should execute the callback when complete', function(done) {
      var mocha = new Mocha(opts);
      mocha.run(function(failures) {
        expect(failures, 'to be', 0);
        done();
      });
    });

    it(
      'should execute the callback with the number of failures ' +
        'as parameter',
      function(done) {
        var mocha = new Mocha(opts);
        var failingTest = new Test('failing test', function() {
          throw new Error('such fail');
        });
        mocha.suite.addTest(failingTest);
        mocha.run(function(failures) {
          expect(failures, 'to be', 1);
          done();
        });
      }
    );

    it('should emit start event', function(done) {
      var mocha = new Mocha(opts);
      mocha.run().on('start', function() {
        this.on('end', done);
      });
    });

    it('should emit end event', function(done) {
      var mocha = new Mocha(opts);
      mocha.run().on('end', done);
    });
  });

  describe('.addFile()', function() {
    it('should add the given file to the files array', function() {
      var mocha = new Mocha(opts);
      mocha.addFile('myFile.js');
      expect(mocha.files, 'to have length', 1).and('to contain', 'myFile.js');
    });
  });

  describe('.invert()', function() {
    it('should set the invert option to true', function() {
      var mocha = new Mocha(opts);
      mocha.invert();
      expect(mocha.options, 'to have property', 'invert', true);
    });

    it('should be chainable', function() {
      var mocha = new Mocha(opts);
      expect(mocha.invert(), 'to be', mocha);
    });
  });

  describe('.ignoreLeaks()', function() {
    it('should set the ignoreLeaks option to true when param equals true', function() {
      var mocha = new Mocha(opts);
      mocha.ignoreLeaks(true);
      expect(mocha.options, 'to have property', 'ignoreLeaks', true);
    });

    it('should set the ignoreLeaks option to false when param equals false', function() {
      var mocha = new Mocha(opts);
      mocha.ignoreLeaks(false);
      expect(mocha.options, 'to have property', 'ignoreLeaks', false);
    });

    it('should set the ignoreLeaks option to false when the param is undefined', function() {
      var mocha = new Mocha(opts);
      mocha.ignoreLeaks();
      expect(mocha.options, 'to have property', 'ignoreLeaks', false);
    });

    it('should be chainable', function() {
      var mocha = new Mocha(opts);
      expect(mocha.ignoreLeaks(), 'to be', mocha);
    });
  });

  describe('.checkLeaks()', function() {
    it('should set the ignoreLeaks option to false', function() {
      var mocha = new Mocha(opts);
      mocha.checkLeaks();
      expect(mocha.options, 'to have property', 'ignoreLeaks', false);
    });

    it('should be chainable', function() {
      var mocha = new Mocha(opts);
      expect(mocha.checkLeaks(), 'to be', mocha);
    });
  });

  describe('.fullTrace()', function() {
    it('should set the fullStackTrace option to true', function() {
      var mocha = new Mocha(opts);
      mocha.fullTrace();
      expect(mocha.options, 'to have property', 'fullStackTrace', true);
    });

    it('should be chainable', function() {
      var mocha = new Mocha(opts);
      expect(mocha.fullTrace(), 'to be', mocha);
    });
  });

  describe('.growl()', function() {
    it('should set the growl option to true', function() {
      var mocha = new Mocha(opts);
      mocha.growl();
      expect(mocha.options, 'to have property', 'growl', true);
    });

    it('should be chainable', function() {
      var mocha = new Mocha(opts);
      expect(mocha.growl(), 'to be', mocha);
    });
  });

  describe('.useInlineDiffs()', function() {
    it('should set the useInlineDiffs option to true when param equals true', function() {
      var mocha = new Mocha(opts);
      mocha.useInlineDiffs(true);
      expect(mocha.options, 'to have property', 'useInlineDiffs', true);
    });

    it('should set the useInlineDiffs option to false when param equals false', function() {
      var mocha = new Mocha(opts);
      mocha.useInlineDiffs(false);
      expect(mocha.options, 'to have property', 'useInlineDiffs', false);
    });

    it('should set the useInlineDiffs option to false when the param is undefined', function() {
      var mocha = new Mocha(opts);
      mocha.useInlineDiffs();
      expect(mocha.options, 'to have property', 'useInlineDiffs', false);
    });

    it('should be chainable', function() {
      var mocha = new Mocha(opts);
      expect(mocha.useInlineDiffs(), 'to be', mocha);
    });
  });

  describe('.noHighlighting()', function() {
    it('should set the noHighlighting option to true', function() {
      var mocha = new Mocha(opts);
      mocha.noHighlighting();
      expect(mocha.options, 'to have property', 'noHighlighting', true);
    });
  });

  describe('.allowUncaught()', function() {
    it('should set the allowUncaught option to true', function() {
      var mocha = new Mocha(opts);
      mocha.allowUncaught();
      expect(mocha.options, 'to have property', 'allowUncaught', true);
    });
  });

  describe('.delay()', function() {
    it('should set the delay option to true', function() {
      var mocha = new Mocha(opts);
      console.error(JSON.stringify(mocha.options, null, 2));
      mocha.delay();
      expect(mocha.options, 'to have property', 'delay', true);
    });
  });

  describe('.bail()', function() {
    it('should set the suite._bail to true if there is no arguments', function() {
      var mocha = new Mocha(opts);
      mocha.bail();
      expect(mocha.suite._bail, 'to be', true);
    });
  });
});
