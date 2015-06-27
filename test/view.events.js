'use strict';

/* deps: mocha */
var assert = require('assert');
var should = require('should');
var App = require('..');
var app

describe('view.option()', function () {
  beforeEach(function () {
    app = new App();
    app.engine('tmpl', require('engine-lodash'));
    app.create('page');
  })

  it('should emit events:', function () {
    app.pages('a.tmpl', {path: 'a.tmpl', content: '<%= a %>'});
    var page = app.pages.get('a.tmpl');
    var events = [];

    page.on('option', function (key, value) {
      events.push(key);
    });

    page.option('a', 'b');
    page.option('c', 'd');
    page.option('e', 'f');
    page.option({g: 'h'});

    events.should.eql(['a', 'c', 'e', 'g']);
  });
});
