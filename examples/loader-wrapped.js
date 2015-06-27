'use strict';

var fs = require('fs');
var glob = require('globby');
var App = require('..');
var app = new App();

app.iterator('sync', require('iterator-sync'));
app.iterator('async', require('iterator-async'));


app.loader('glob', function _glob(views, opts) {
  return function (pattern) {
    return glob.sync(pattern);
  };
});

app.loader('read', ['glob'], function _read(views, opts) {
  return function (files) {
    return files.reduce(function (acc, fp) {
      acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
      return acc;
    }, views);
  };
});


app.create('page');
app.pages('test/fixtures/*.txt', ['read']);

console.log(app.views.pages)

app.loader('glob', {loaderType: 'async'}, function(views, opts) {
  return function (pattern, next) {
    glob(pattern, next);
  };
});

app.loader('read', {loaderType: 'async'}, ['glob'], function(views, opts) {
  return function (files, next) {
    next(null, files.reduce(function (acc, fp) {
      acc[fp] = {path: fp, content: fs.readFileSync(fp, 'utf8')};
      return acc;
    }, views));
  };
});


app.create('posts', {loaderType: 'async'});
app.posts('test/fixtures/*.txt', ['read'], function (err) {
  console.log(app.views.posts);
});

