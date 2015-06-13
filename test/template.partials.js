/*!
 * template <https://github.com/jonschlinkert/template>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert, Brian Woodward.
 * Licensed under the MIT License (MIT)
 */

'use strict';

require('should');
var assert = require('assert');
var Template = require('./app');
var template;

describe('template partial', function () {
  beforeEach(function () {
    template = new Template();
    template.engine('md', require('engine-lodash'));
    template.enable('frontMatter');
  });

  describe('.partial() strings', function () {
    it('should add partials to views.', function () {
      template.partials('a.md', 'b');
      template.views.partials.should.have.property('a.md');
    });

    it('should put partials on the `views.partials` object.', function () {
      template.partials('a.md', 'b');
      template.views.partials['a.md'].should.have.property('content', 'b');
    });

    it('should get partials with the `.getPartial()` method', function () {
      template.partials('a.md', 'b');
      template.getPartial('a.md').content.should.equal('b');
    });

    it('should get partials with the `.getView()` collection method', function () {
      template.partials('a.md', 'b');
      template.getView('partials', 'a.md').content.should.equal('b');
    });

    it('should add the template string to the `content` property.', function () {
      template.partials('a.md', 'this is content.');
      template.views.partials['a.md'].content.should.equal('this is content.');
    });

    it('should add locals to the `locals` property.', function () {
      template.partials('a.md', 'b', {c: 'c'});
      template.views.partials['a.md'].locals.should.have.property('c');
    });

    it('should add locals to the `locals` property.', function () {
      template.partials('a.md', 'b', {c: 'c'});
      template.views.partials['a.md'].locals.should.have.property('c');
    });

    it('should add the third arg to the `locals` property.', function () {
      template.partials('a.md', 'b', {title: 'c'});
      template.views.partials['a.md'].locals.should.have.property('title');
    });
  });

  describe('.partials() objects', function () {
    it('should add partials to views.', function () {
      template.partials({'a.md': {content: 'b', data: {c: 'c'}}});
      template.views.partials.should.have.property('a.md');
    });

    it('should add the template string to the `content` property.', function () {
      template.partials({'a.md': {content: 'b', data: {c: 'c'}}});
      template.views.partials['a.md'].content.should.equal('b');
    });

    it('should add locals to the `data` property.', function () {
      template.partials({'a.md': {content: 'b', data: {c: 'c'}}});
      template.views.partials['a.md'].data.should.have.property('c');
    });

    it('should add locals to the `data` property.', function () {
      template.partials({'a.md': {content: 'b', data: {c: 'c'}}});
      template.views.partials['a.md'].data.should.have.property('c');
    });
  });

  describe('when a partial has front matter', function () {
    it('should parse the partial.', function () {
      template.partials('a.md', '---\nname: AAA\n---\nThis is content.');
      template.views.partials['a.md'].should.have.property('content', 'This is content.');
    });

    it('should parse the `content` value.', function () {
      template.partials({'a.md': {path: 'a.md', content: '---\nname: AAA\n---\nThis is content.'}});
      template.views.partials.should.have.property('a.md');
    });

    it('should merge locals and front-matter data.', function () {
      template.partials({'a.md': {content: '---\nname: AAA\n---\nThis is content.', data: {c: 'c'}}});
      template.views.partials['a.md'].should.have.property('data', { c: 'c', name: 'AAA' });
    });

    it('should save both locals and front-matter data to the `file` object.', function () {
      template.partials({'a.md': {content: '---\nname: AAA\n---\nThis is content.', locals: {name: 'BBB'}}});
      template.views.partials['a.md'].should.have.property('data', { name: 'AAA' });
      template.views.partials['a.md'].should.have.property('locals');
      template.views.partials['a.md'].locals.should.have.property('name', 'BBB');
    });

    it('should use the key as `file.path` if one does not exist.', function () {
      template.partials({'a.md': {content: '---\nname: AAA\n---\nThis is content.', data: {c: 'c'}}});
      template.views.partials['a.md'].path.should.equal('a.md');
    });
  });

  describe('context', function () {
    it('should prefer helper locals over template locals.', function (done) {
      template.partials('alert.md', '---\nlayout: href\ntitle: partial yfm data\n---\n<%= title %>.', {title: 'partial locals'});
      template.page('home.md', '---\ntitle: Baz\nlayout: page yfm data\n---\n<%= title %>.\n<%= partial("alert.md", {title: "helper locals"}) %>', {title: 'page locals'});

      template.render('home.md', function (err, content) {
        if (err) return done(err);
        content.should.equal('Baz.\nhelper locals.');
        done();
      });
    });

    it('should prefer `.render()` locals over template locals.', function (done) {
      template.partials('alert.md', '---\nlayout: href\ntitle: partial yfm data\n---\n<%= title %>.', {title: 'partial locals'});
      template.page('home.md', '---\ntitle: Baz\nlayout: page yfm data\n---\n<%= title %>.\n<%= partial("alert.md", {title: "helper locals"}) %>', {title: 'page locals'});

      template.render('home.md', {title: 'render locals'}, function (err, content) {
        if (err) return done(err);
        content.should.equal('render locals.\nhelper locals.');
        done();
      });
    });

    it('should prefer helper locals over template locals.', function (done) {
      template.partials('alert.md', '---\nlayout: href\ntitle: Foo\n---\nThis is <%= title %>.');
      template.page('home.md', '---\ntitle: Baz\nlayout: default\n---\nThis is <%= title %>.\n<%= partial("alert.md", {title: "Fez"}) %>');
      template.render('home.md', function (err, content) {
        if (err) return done(err);
        content.should.equal('This is Baz.\nThis is Fez.');
        done();
      });
    });
  });

  describe('when a partial has a layout defined:', function () {
    it('should parse the partial sync.', function () {
      template.layout('default.md', 'bbb{% body %}bbb');
      template.layout('href.md', '<a href="{% body %}"><%= text %></a>');
      template.partials('link.md', '---\nlayout: href.md\ntext: Jon Schlinkert\n---\nhttps://github.com/jonschlinkert', {a: 'b'});
      template.page('home.md', '---\nname: Home Page\nlayout: default.md\n---\nThis is home page content.\n<%= partial("link.md", {c: "d"}) %>');

      var content = template.render('home.md');
      content.should.equal('bbbThis is home page content.\n<a href="https://github.com/jonschlinkert">Jon Schlinkert</a>bbb');
    });

    it('should parse the partial.', function (done) {
      template.layout('default.md', 'bbb{% body %}bbb');
      template.layout('href.md', '<a href="{% body %}"><%= text %></a>');
      template.partials('link.md', '---\nlayout: href.md\ntext: Jon Schlinkert\n---\nhttps://github.com/jonschlinkert', {a: 'b'});
      template.page('home.md', '---\nname: Home Page\nlayout: default.md\n---\nThis is home page content.\n<%= partial("link.md", {c: "d"}) %>');

      template.render('home.md', function (err, content) {
        if (err) return done(err);
        content.should.equal('bbbThis is home page content.\n<a href="https://github.com/jonschlinkert">Jon Schlinkert</a>bbb');
        done();
      });
    });
  });
});
