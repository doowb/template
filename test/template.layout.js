/*!
 * engine <https://github.com/jonschlinkert/engine>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors
 * Licensed under the MIT License (MIT)
 */

'use strict';

var assert = require('assert');
var should = require('should');
var Engine = require('..');
var template;

describe('engine layout', function () {
  beforeEach(function () {
    template = new Engine();
  });

  describe('.layout() strings', function () {
    it('should add a layout to the cache.', function () {
      template.layout('a.md', 'b');
      template.cache.layouts.should.have.property('a.md');
    });

    it('should `.get()` a layout from the cache.', function () {
      template.layout('a.md', 'b');
      template.get('layouts.a\\.md').content.should.equal('b'); // escaped for [getobject]
    });

    it('should add the template string to the `content` property.', function () {
      template.layout('a.md', 'this is content.');
      template.cache.layouts['a.md'].content.should.equal('this is content.');
    });

    it('should add add the string to a `content` property.', function () {
      template.layout('a.md', 'b');
      template.cache.layouts['a.md'].should.have.property('content', 'b');
    });

    it('should add locals to the `locals` property.', function () {
      template.layout('a.md', 'b', {c: 'c'});
      template.cache.layouts['a.md'].locals.should.have.property('c');
    });

    it('should add locals to the `locals` property.', function () {
      template.layout('a.md', 'b', {c: 'c'});
      template.cache.layouts['a.md'].locals.should.have.property('c');
    });

    it('should add the third arg to the `locals` property.', function () {
      template.layout('a.md', 'b', {title: 'c'});
      template.cache.layouts['a.md'].locals.should.have.property('title');
    });
  });

  describe('.layout() objects', function () {
    it('should add a layout to the cache.', function () {
      template.layout({'a.md': {content: 'b', data: {c: 'c'}}});
      template.cache.layouts.should.have.property('a.md');
    });

    it('should add the template string to the `content` property.', function () {
      template.layout({'a.md': {content: 'b', data: {c: 'c'}}});
      template.cache.layouts['a.md'].content.should.equal('b');
    });

    it('should add locals to the `data` property.', function () {
      template.layout({'a.md': {content: 'b', data: {c: 'c'}}});
      template.cache.layouts['a.md'].should.have.property('data', {c: 'c'});
      template.cache.layouts['a.md'].should.have.property('content', 'b');
    });

    it('should add locals to the `data` property.', function () {
      template.layout({'a.md': {content: 'b', data: {c: 'c'}}});
      template.cache.layouts['a.md'].data.should.have.property('c');
    });
  });

  describe('when a layout has front matter', function () {
    it('should parse the layout.', function () {
      template.layout('a.md', '---\nname: AAA\n---\nThis is content.');
      template.cache.layouts['a.md'].should.have.property.content;
      template.cache.layouts['a.md'].content.should.equal('This is content.');
    });

    it('should parse the `content` value.', function () {
      template.layout({'a.md': {path: 'a.md', content: '---\nname: AAA\n---\nThis is content.'}});
      template.cache.layouts.should.have.property('a.md');
    });

    it('should keep locals and front-matter data separate.', function () {
      template.layout({'a.md': {content: '---\nname: AAA\n---\nThis is content.', locals: {c: 'c'}}});
      template.cache.layouts['a.md'].should.have.property('data', { name: 'AAA' });
      template.cache.layouts['a.md'].should.have.property('locals', { c: 'c' });
    });

    it('should save both locals and front-matter data to the `file` object.', function () {
      template.layout({'a.md': {content: '---\nname: AAA\n---\nThis is content.', name: 'BBB'}});
      template.cache.layouts['a.md'].data.name.should.equal('AAA');
      template.cache.layouts['a.md'].locals.name.should.equal('BBB');
    });

    it('should use the key as `file.path` if one does not exist.', function () {
      template.layout({'a.md': {content: '---\nname: AAA\n---\nThis is content.', data: {c: 'c'}}});
      template.cache.layouts['a.md'].path.should.equal('a.md');
    });
  });
});