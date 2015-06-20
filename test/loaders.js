/*!
 * template <https://github.com/jonschlinkert/template>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert, Brian Woodward.
 * Licensed under the MIT License (MIT)
 */

'use strict';

require('should');
var fs = require('fs');
var async = require('async');
var path = require('path');
var glob = require('globby');
var through = require('through2');
var Template = require('../');
var template;

describe('loaders', function () {
  describe('errors:', function () {
    beforeEach(function () {
      template = new Template();
    });

    it('create should throw an error when args are invalid:', function () {
      (function () {
        template.create();
      }).should.throw('Template#create: expects singular to be a string');
    });
  });

  describe('sync:', function () {
    beforeEach(function () {
      template = new Template();
    });

    describe('.loader():', function () {
      it('should register sync loaders', function () {
        template.loader('a', function () {});
        template.loader('b', function () {});
        template.loader('c', function () {});
        template.loaders.sync.should.have.properties(['a', 'b', 'c']);
      });
    });

    describe('.create():', function () {
      it('should use a loader function defined on the create method:', function () {
        template.create('post', { viewType: 'renderable' }, function post(patterns) {
          var files = glob.sync(patterns);
          return files.reduce(function (acc, fp) {
            acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
            return acc;
          }, {});
        });

        template.posts('test/fixtures/*.txt');
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });

      it('should use a combination of loaders defined on create and the collection loader:', function () {
        template.create('post', { viewType: 'renderable' }, function post(patterns) {
          return glob.sync(patterns);
        });

        template.loader('abc', function abc(files) {
          return files;
        });

        template.loader('toTemplate', ['abc'], function toTemplate(files) {
          return files.reduce(function (acc, fp) {
            acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
            return acc;
          }, {});
        });
        template.posts('test/fixtures/*.txt', ['toTemplate']);
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });

      it('should use an array of registered loaders:', function () {
        template.loader('first', function (name) {
          var file = {};
          file[name] = {path: name, content: 'this is content...'};
          return file;
        });
        template.loader('abc', function (files) {
          files.abc = {content: 'this is abc...'}
          return files;
        });
        template.loader('xyz', function (files) {
          files.xyz = {content: 'this is xyz...'}
          return files;
        });
        // loaders are on passed to .create
        template.create('posts', ['first', 'abc', 'xyz']);
        template.posts('foo');
        template.views.posts.should.have.property('foo');
        template.views.posts.should.have.property('abc');
        template.views.posts.should.have.property('xyz');
        template.views.posts.foo.content.should.equal('this is content...');
      });

      it('should add the values to views:', function () {
        template.loader('a', function (val) {
          val = val + 'a';
          return val
        });
        template.loader('b', function (val) {
          val = val + 'b';
          return val
        });
        template.loader('c', function (val) {
          val = val + 'c';
          return val
        });
        template.create('posts')
        template.posts('-', ['a', 'b', 'c'], function (val) {
          return {foo: {content: val}};
        });
        template.views.posts.should.have.property('foo');
        template.views.posts.foo.content.should.equal('-abc');
      });

      it('should use an array of functions:', function () {
        var options = {};
        template.create('post', { viewType: 'renderable' }, [
          function (patterns) {
            return glob.sync(patterns, options);
          },
          function (files) {
            return files.reduce(function (acc, fp) {
              acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
              return acc;
            }, {});
          }
        ]);

        template.posts('test/fixtures/*.txt', {a: 'b'});
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });

      it('should use a list of functions:', function () {
        var options = {};
        template.create('post', { viewType: 'renderable' },
          function (patterns) {
            return glob.sync(patterns, options);
          },
          function (files) {
            return files.reduce(function (acc, fp) {
              acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
              return acc;
            }, {});
        });

        template.posts('test/fixtures/*.txt', {a: 'b'});
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });

      it('should use functions on create and the collection:', function () {
        var options = {};
        template.create('post', { viewType: 'renderable' }, function (patterns) {
          return glob.sync(patterns, options);
        });

        template.posts('test/fixtures/*.txt', {a: 'b'}, function (files) {
          return files.reduce(function (acc, fp) {
            acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
            return acc;
          }, {});
        });
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });
    });

    describe('collection:', function () {
      it('should use an array of registered loaders:', function () {
        template.loader('first', function first(name) {
          var file = {};
          file[name] = {path: name, content: 'this is content...'};
          return file;
        });
        template.loader('abc', function abc(files) {
          files.abc = {content: 'this is abc...'}
          return files;
        });
        template.loader('xyz', function xyz(files) {
          files.xyz = {content: 'this is xyz...'}
          return files;
        });
        template.create('posts');
        // loaders are on the collection
        template.posts('foo', ['first', 'abc', 'xyz']);
        // console.log(template.views.posts)
        template.views.posts.should.have.property('foo');
        template.views.posts.should.have.property('abc');
        template.views.posts.should.have.property('xyz');
        template.views.posts.foo.content.should.equal('this is content...');
      });

      it('should use an array of functions:', function () {
        var options = {};
        template.create('post', { viewType: 'renderable' });

        template.posts('test/fixtures/*.txt', {a: 'b'}, [
          function (patterns) {
            return glob.sync(patterns, options);
          },
          function (files) {
            return files.reduce(function (acc, fp) {
              acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
              return acc;
            }, {});
          }
        ]);
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });

      it('should use a list of functions:', function () {
        var options = {};
        template.create('post', { viewType: 'renderable' });

        template.posts('test/fixtures/*.txt', {a: 'b'},
          function (patterns) {
            return glob.sync(patterns, options);
          },
          function (files) {
            return files.reduce(function (acc, fp) {
              acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
              return acc;
            }, {});
        });
        template.views.posts.should.have.property('test/fixtures/a.txt');
      });
    });

    describe('.iterator():', function () {
      it('should register a sync iterator', function () {
        template.iterator('sync', function () {});
        template.iterator('async', function () {});
        template.iterators.should.have.properties(['sync', 'async']);
      });
    });
  });

  describe('async:', function () {
    beforeEach(function () {
      template = new Template();
    });

    describe('.create():', function () {
      it('should use an array of registered loaders:', function (done) {
        var opts = { loaderType: 'async' };

        // register the loaders
        template.loader('first', opts, function first(name, opts, next) {
          if (typeof opts === 'function') {
            next = opts;
            opts = {};
          }
          var file = {};
          file[name] = {path: name, content: 'this is content...'};
          next(null, file);
        });

        template.loader('abc', opts, function abc(files, next) {
          files.abc = {content: 'this is abc...'}
          next(null, files);
        });

        template.loader('xyz', opts, function xyz(files, next) {
          files.xyz = {content: 'this is xyz...'}
          next(null, files);
        });

        // pass the array of loaders to .create
        template.create('posts', opts, ['first', 'abc', 'xyz']);
        template.posts('foo', opts, function foo(files, next) {
          next(null, files);
        }, done);
      });

      it('should use an array of registered loaders passed to a collection:', function (done) {
        var opts = { loaderType: 'async' };

        // register the loaders
        template.loader('first', opts, function (name, opts, next) {
          if (typeof opts === 'function') {
            next = opts;
            opts = {};
          }
          var file = {};
          file[name] = {path: name, content: 'this is content...'};
          next(null, file);
        });
        template.loader('abc', opts, function (files, next) {
          files.abc = {content: 'this is abc...'}
          next(null, files);
        });
        template.loader('xyz', opts, function (files, next) {
          files.xyz = {content: 'this is xyz...'}
          next(null, files);
        });

        template.create('posts', opts);
        // pass the array of loaders to the collection loader
        template.posts('foo', opts, ['first', 'abc', 'xyz'], function (files, next) {
          next(null, files);
        }, function (err) {
          if (err) return done(err);
          template.views.posts.should.have.property('foo');
          template.views.posts.should.have.property('abc');
          template.views.posts.should.have.property('xyz');
          template.views.posts.foo.content.should.equal('this is content...');
          done();
        });
      });

      it('should use custom async loaders', function (done) {
        var opts = { viewType: 'renderable', loaderType: 'async' };

        template.create('post', opts, function create(pattern, next) {
          glob(pattern, function (err, files) {
            if (err) return next(err);
            next(null, files);
          })
        });

        template.loader('toTemplate', opts, function toTemplate(files, next) {
          async.reduce(files, {}, function (acc, fp, cb) {
            acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
            cb(null, acc);
          }, next);
        });

        template.posts('test/fixtures/*.txt', ['toTemplate'], function posts(posts, next) {
          next(null, posts);
        }, function doneFn(err) {
          if (err) return done(err);
          template.views.posts.should.have.property('test/fixtures/a.txt');
          done();
        });
      });

      it('should use a loader function defined on the create method:', function (done) {
        var opts = { viewType: 'renderable', loaderType: 'async' };

        template.create('file', opts, glob);
        template.loader('toTemplate', opts, function (files, next) {
          async.reduce(files, {}, function (acc, fp, cb) {
            acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
            cb(null, acc);
          }, next);
        });

        template.files('test/fixtures/*.txt', ['toTemplate'], function (files, next) {
          next(null, files);
        }, function doneFn(err) {
          if (err) return done(err);
          template.views.files.should.have.property('test/fixtures/a.txt');
          done();
        });
      });
    });
  });

  describe('promise:', function () {
    beforeEach(function () {
      template = new Template();
    });

    it('should use custom promise loaders', function (done) {
      var Promise = require('bluebird');
      var options = { viewType: 'renderable', loaderType: 'promise' };

      template.create('post', options, Promise.method(function (patterns, opts) {
        return glob.sync(patterns, opts);
      }));

      template.loader('toTemplate', {loaderType: 'promise'}, Promise.method(function(files) {
        return files.reduce(function (acc, fp) {
          acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
          return acc;
        }, {});
      }));

      template.loader('data', {loaderType: 'promise'}, Promise.method(function(files) {
        for (var key in files) {
          if (files.hasOwnProperty(key)) {
            files[key].data = {title: path.basename(key, path.extname(key))};
          }
        }
        return files;
      }));

      template.posts('test/fixtures/*.txt', ['toTemplate', 'data'])
        .then(function (posts) {
          posts.should.have.property('test/fixtures/a.txt');
          posts.should.have.property('test/fixtures/b.txt');
          posts.should.have.property('test/fixtures/c.txt');
          template.views.posts.should.have.property('test/fixtures/a.txt');
          done();
        });
    });
  });

  describe('stream:', function () {
    beforeEach(function () {
      template = new Template();
    });

    it('should use custom stream loaders', function (done) {
      var opts = {loaderType: 'stream'};

      template.loader('glob', opts, function() {
        return through.obj(function (pattern, enc, next) {
          var stream = this;

          glob(pattern, function (err, files) {
            if (err) return next(err);
            stream.push(files);
            return next();
          });
        });
      });

      template.loader('toVinyl', opts, ['glob'], through.obj(function toVinyl(files, enc, next) {
        var stream = this;
        files.forEach(function (fp) {
          stream.push({
            path: fp,
            contents: fs.readFileSync(fp)
          });
        });
        return next();
      }));

      template.loader('plugin', opts, through.obj(function plugin(file, enc, next) {
        var str = file.contents.toString();
        var res = {};
        file.contents = new Buffer(str.toLowerCase());
        res[file.path] = file;
        this.push(res);
        return next();
      }));

      template.create('post', { viewType: 'renderable', loaderType: 'stream' });

      template.posts('test/fixtures/*.txt', ['toVinyl', 'plugin'])
        .pipe(through.obj(function(file, enc, next) {
          this.push(file);
          return next();
        }, function () {
          done();
        }))
        .on('error', console.error)
        .on('end', done);
    });
  });
});
