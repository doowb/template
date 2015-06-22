'use strict';

var Router = require('en-route').Router;
var Template = require('..');
var template = new Template({ router: Router });


template.onLoad(/\.tmpl/, function (file, next) {
  file.content = file.content.toUpperCase();
  next();
});

template.preRender(/\.tmpl/, function (file, next) {
  file.content = 'pre - ' + file.content;
  next();
});

template.postRender(/\.tmpl/, function (file, next) {
  file.content = file.content + ' - post';
  next();
});


/**
 * Loader
 */
template.engine('tmpl', require('engine-lodash'));

/**
 * Loader
 */
template.iterator('sync', require('iterator-sync'));
template.loader('sync', function (key, value) {
  return (this[key] = value);
});

/**
 * Create
 */
template.create('pages', { loaderType: 'sync' });

/**
 * Load
 */
template.pages('a.tmpl', {path: 'a.tmpl', content: '<%= name %>', name: 'aaa'});
template.pages('b.tmpl', {path: 'b.tmpl', content: '<%= name %>', name: 'bbb'});
template.pages('c.tmpl', {path: 'c.tmpl', content: '<%= name %>', name: 'ccc'});
template.pages('d.tmpl', {path: 'd.tmpl', content: '<%= name %>', name: 'ddd'})
  .use(function (views, options, loaders) {
    // console.log(arguments)
  })

var a = template.getView('pages', 'a.tmpl');

template.render(a, {}, function (err, res) {
  if (err) return console.log(err);
  console.log('Template#render:', arguments)
});


var b = template.getView('pages', 'b.tmpl');
b.render({}, function () {
  console.log('View#render:', arguments)
});
