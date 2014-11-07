/*!
 * template <https://github.com/jonschlinkert/template>
 *
 * Copyright (c) 2014 Halle Nicole, contributors
 * Licensed under the MIT License (MIT)
 */

'use strict';

var async = require('async');
var should = require('should');
var Template = require('..');
var template;
var consolidate = require('consolidate');
var handlebars = consolidate.handlebars;
var lodash = consolidate.lodash;
var swig = consolidate.swig;


describe('generated helpers:', function () {
  beforeEach(function () {
    template = new Template();
  });

  describe('helpers for built-in engines:', function () {
    it('should use the `partial` helper with a built-in engine.', function (done) {
      template.partial('a.md', {content: '---\nname: "AAA"\n---\n<%= name %>', locals: {name: 'BBB'}});
      template.page('b.md', {path: 'b.md', content: 'foo <%= partial("a.md") %> bar'});

      template.render('b.md', function (err, content) {
        if (err) return done(err);
        content.should.equal('foo AAA bar');
        done();
      });
    });

    it('should use the `partial` helper and locals with a built-in engine.', function (done) {
      template.partial('abc.md', {content: '---\nname: "AAA"\n---\n<%= name %>', locals: {name: 'BBB'}});
      template.page('xyz.md', {path: 'xyz.md', content: 'foo <%= partial("abc.md", { name: "CCC" }) %> bar'});

      template.render('xyz.md', {name: 'DDD'}, function (err, content) {
        if (err) return done(err);
        content.should.equal('foo CCC bar');
        done();
      });
    });
  });


  describe('helper context:', function () {
    it('should give preference to front-matter over template locals and helper locals.', function (done) {
      template.partial('a.md', {content: '---\nname: "AAA"\n---\n<%= name %>', locals: {name: 'BBB'}});
      template.page('b.md', {path: 'b.md', content: 'foo <%= partial("a.md") %> bar'});

      template.render('b.md', function (err, content) {
        if (err) return done(err);
        content.should.equal('foo AAA bar');
        done();
      });
    });

    it('should give preference to helper locals over template locals.', function (done) {
      template.partial('abc.md', {content: '<%= name %>', name: 'BBB'});
      template.page('xyz.md', {path: 'xyz.md', content: 'foo <%= partial("abc.md", { name: "CCC" }) %> bar'});

      template.render('xyz.md', {name: 'DDD'}, function (err, content) {
        if (err) return done(err);
        content.should.equal('foo CCC bar');
        done();
      });
    });

    it('should give preference to template locals over render locals.', function (done) {
      template.partial('abc.md', {content: '<%= name %>', name: 'BBB'});
      template.page('xyz.md', {path: 'xyz.md', content: 'foo <%= partial("abc.md") %> bar'});

      template.render('xyz.md', {name: 'DDD'}, function (err, content) {
        if (err) return done(err);
        content.should.equal('foo DDD bar');
        done();
      });
    });

    it('should use render locals when other locals are not defined.', function (done) {
      template.partial('abc.md', {content: '<%= name %>'});
      template.page('xyz.md', {path: 'xyz.md', content: 'foo <%= partial("abc.md") %> bar'});

      template.render('xyz.md', {name: 'DDD'}, function (err, content) {
        if (err) return done(err);
        content.should.equal('foo DDD bar');
        done();
      });
    });
  });


  describe('user-defined engines:', function () {
    it('should use the `partial` helper with handlebars.', function (done) {
      template.engine('hbs', handlebars);

      template.partial('title.hbs', {content: '<title>{{name}}</title>', locals: {name: 'BBB'}});
      template.page('a.hbs', {path: 'a.hbs', content: 'foo {{{partial "title.hbs" this}}} bar'});

      template.render('a.hbs', {name: 'Halle Nicole' }, function (err, content) {
        if (err) return done(err);
        content.should.equal('foo <title>Halle Nicole</title> bar');
        done();
      });
    });

    it('should use the `partial` helper with any engine.', function (done) {
      template.engine('hbs', handlebars);
      template.engine('md', handlebars);
      template.engine('swig', swig);
      template.engine('tmpl', lodash);

      template.partial('a.hbs', {content: '---\nname: "AAA"\n---\n<title>{{name}}</title>', locals: {name: 'BBB'}});
      template.page('a.hbs', {path: 'a.hbs', content: '<title>{{author}}</title>', locals: {author: 'Halle Nicole'}});
      template.page('b.tmpl', {path: 'b.tmpl', content: '<title><%= author %></title>', locals: {author: 'Halle Nicole'}});
      template.page('d.swig', {path: 'd.swig', content: '<title>{{author}}</title>', locals: {author: 'Halle Nicole'}});
      template.page('e.swig', {path: 'e.swig', content: '<title>{{author}}</title>', locals: {author: 'Halle Nicole'}});
      template.page('f.hbs', {content: '<title>{{author}}</title>', locals: {author: 'Halle Nicole'}});
      template.page('g.md', {content: '---\nauthor: Brian Woodward\n---\n<title>{{author}}</title>', locals: {author: 'Halle Nicole'}});
      template.page('with-partial.hbs', {path: 'with-partial.hbs', content: '{{partial "a.hbs" custom.locals}}'});

      template.render('a.hbs', {custom: {locals: {name: 'Halle Nicole' }}}, function (err, content) {
        if (err) console.log(err);
        content.should.equal('<title>Halle Nicole</title>');
      });

      template.render('with-partial.hbs', {custom: {locals: {name: 'Halle Nicole' }}}, function (err, content) {
        if (err) console.log(err);
        content.should.equal('<title>Halle Nicole</title>');
      });

      async.each(template.cache.pages, function (file, next) {
        var page = template.cache.pages[file];

        template.render(page, {custom: {locals: {name: 'Halle Nicole' }}}, function (err, content) {
          if (err) return next(err);
          content.should.equal('<title>Halle Nicole</title>');
          next(null);
        });
      });
      done();
    });
  });
});