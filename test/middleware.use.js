/*!
 * template <https://github.com/jonschlinkert/template>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert, Brian Woodward.
 * Licensed under the MIT License (MIT)
 */

'use strict';

var fs = require('fs');
var path = require('path');
var should = require('should');
var pretty = require('verb-prettify');
var Template = require('./app');
var template;
var tokens;


describe('.use()', function () {
  beforeEach(function () {
    template = new Template();
  });

  it('should run once for every method:', function (done) {
    template.use(/./, function (file, next) {
      file.content = file.content + 'A';
      next();
    });

    template.page('foo', {content: 'letters:'});
    template.render('foo', function (err, content) {
      if (err) console.log(err);
      content.should.equal('letters:AAAA');
      done();
    });
  });
});
