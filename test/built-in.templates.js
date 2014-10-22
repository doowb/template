/*!
 * engine <https://github.com/jonschlinkert/engine>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors
 * Licensed under the MIT License (MIT)
 */

'use strict';

var should = require('should');
var Engine = require('..');
var template = new Engine();


describe('default templates:', function () {
  it('should have `partial` and `partials` on the cache.', function () {
    template.should.have.properties(['partial', 'partials']);
  });

  it('should have `page` and `pages` on the cache.', function () {
    template.should.have.properties(['page', 'pages']);
  });

  it('should have `layout` and `layouts` on the cache.', function () {
    template.should.have.properties(['layout', 'layouts']);
  });
});
