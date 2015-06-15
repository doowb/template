'use strict';

// require('time-require');
var through = require('through2');
var isObject = require('isobject');
var extend = require('extend-shallow');
var inflect = require('pluralize');
var flatten = require('arr-flatten');
var pickFrom = require('pick-from');
var cloneDeep = require('clone-deep');
var set = require('set-value');

var ConfigCache = require('config-cache');
var EngineCache = require('engine-cache');
var HelperCache = require('helper-cache');
var LoaderCache = require('loader-cache');
var OptionCache = require('option-cache');
var PlasmaCache = require('plasma-cache');

var Collection = require('./lib/collection');
var assert = require('./lib/error/assert');
var error = require('./lib/error/base');
var iterators = require('./lib/iterators');
var loaders = require('./lib/loaders/index.js');
var transforms = require('./lib/transforms');
var utils = require('./lib/utils');
var validate = require('./lib/validate');

/**
 * Create an instance of `Template` with the given `options`.
 *
 * @param {Object} `options`
 * @api public
 */
function Template(options) {
  ConfigCache.call(this);
  OptionCache.call(this, options);
  PlasmaCache.call(this, {
    plasma: require('plasma')
  });
  this.initDefaults();
  this.initTypes();
  this.initTransforms();
  this.initConfig();
}

ConfigCache.mixin(Template.prototype);
extend(Template.prototype, OptionCache.prototype);
extend(Template.prototype, PlasmaCache.prototype);

/**
 * Initialize template and loader types
 */

Template.prototype.initDefaults = function() {
  // error handling
  this.mixin('assert', assert.bind(this));
  this.mixin('error', error.bind(this));

  // config
  this.transforms = {};
  this.dataLoaders = {};
  this.iterators = {};
  this.loaders = {};
  this.engines = {};
  this.helpers = {};
  this.errorsList = [];

  this.contexts = {};
  this.contexts.create = {};
  this.options.views = {};
  this.cache.context = {};
  this.viewTypes = {};
  this.views = {};
  this.inflections = {};

  this._ = {};
  this._.loaders = {};
  this._.helpers = {};
  this._.engines = new EngineCache(this.engines);
};

/**
 * Initialize template and loader types
 */

Template.prototype.initTypes = function() {
  // iterators
  this.iterator('sync', iterators.sync);
  this.iterator('async', iterators.async);
  this.iterator('promise', iterators.promise);
  this.iterator('stream', iterators.stream);

  // loader types
  this.loaderType('sync');
  this.loaderType('async');
  this.loaderType('promise');
  this.loaderType('stream');

  // view types
  this.viewType('renderable');
  this.viewType('layout');
  this.viewType('partial');

  // helper types
  this.helperType('sync');
  this.helperType('async');
};

/**
 * Initialize default transforms.
 */

Template.prototype.initTransforms = function() {
  this.transform('engines', transforms.engines);
  this.transform('helpers', transforms.helpers);
  this.transform('lookups', transforms.lookups);
  this.transform('routes', transforms.routes);
  this.transform('layouts', transforms.layouts);
  this.transform('middleware', transforms.middleware);
  this.transform('context', transforms.context);
  this.transform('render', transforms.render);
};

/**
 * Initialize configuration defaults
 */

Template.prototype.initConfig = function() {
  this.enable('default routes');
  this.enable('default helpers');
  this.enable('mergePartials');
  this.disable('preferLocals');

  this.create('page', { viewType: 'renderable' });
  this.create('partial', { viewType: 'partial' });
  this.create('layout', { viewType: 'layout' });

  // layouts
  this.option('layoutDelims', ['{%', '%}']);
  this.option('layoutTag', 'body');

  // engines
  this.option('view engine', '*');
  this.disable('debugEngine');
  this.engine('.*', function noop(str, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts; opts = {};
    }
    cb(null, str);
  });

  // load default helpers and templates
  this.loader('helpers', loaders.helpers(this));
  this.loader('default', { loaderType: 'sync' }, loaders.defaults(this).sync);
  this.loader('default', { loaderType: 'async' }, loaders.defaults(this).async);
  this.loader('default', { loaderType: 'promise' }, loaders.defaults(this).promise);
  this.loader('default', { loaderType: 'stream' }, loaders.defaults(this).stream);
};

/**
 * Transforms are run immediately during init, and are used to
 * extend or modify the `this` object.
 *
 * @param {String} `name` The name of the transform to add.
 * @param {Function} `fn` The actual transform function.
 * @return {Object} Returns `Template` for chaining.
 * @api public
 */

Template.prototype.transform = function(name, fn) {
  if (typeof fn === 'function') {
    this.transforms[name] = fn;
  } else {
    fn = name;
  }
  this.assert('transform', 'fn', 'function', fn);
  fn.call(this, this);
  return this;
};

/**
 * Register an iterator to use with loaders.
 *
 * @param {String} `type`
 * @param {Function} `fn` Iterator function
 * @api public
 */

Template.prototype.iterator = function(type, fn) {
  this.assert('iterator', 'type', 'string', type);
  this.assert('iterator', 'fn', 'function', fn);
  if (!this.iterators.hasOwnProperty(type)) {
    this.iterators[type] = fn;
  }
  return this;
};

/**
 * Private method for registering loader types.
 *  | async
 *  | sync
 *  | stream
 *  | promise
 */

Template.prototype.loaderType = function(type, opts) {
  this.loaders[type] = this.loaders[type] || {};
  this._.loaders[type] = new LoaderCache(extend({
    cache: this.loaders[type]
  }, opts));
};

/**
 * Private method for registering helper types.
 */

Template.prototype.helperType = function(type) {
  this._.helpers[type] = new HelperCache({bind: false});
};

/**
 * Register a context for a view.
 */

Template.prototype.context = function(view, prop, val) {
  if (!isObject(view)) return;
  var contexts = ['contexts'].concat(utils.arrayify(prop));
  return set(view, contexts.join('.'), val);
};

/**
 * Register a new view type.
 *
 * @param  {String} `name` The name of the view type to create.
 * @api public
 */

Template.prototype.viewType = function(name) {
  this.viewTypes[name] = [];
};

/**
 * Register a loader.
 *
 * @param  {String} `name` Loader name.
 * @param  {String} `options` Loaders default to `sync` when a `type` is not passed.
 * @param  {Array|Function} `stack` Array or list of loader functions or names.
 * @return {Object} `Template` for chaining
 * @api public
 */

Template.prototype.loader = function(name/*, opts, stack*/) {
  this.assert('loader', 'name', 'string', name);
  var args = utils.siftArgs.apply(this, [].slice.call(arguments, 1));
  this.getLoaderInstance(args.opts).register(name, args.stack);
  return this;
};

/**
 * Get a cached loader instance.
 *
 * @param  {String|Object} `type` Pass the type or an options object with `loaderType`.
 * @return {Object} The loader object
 * @api public
 */

Template.prototype.getLoaderInstance = function(type) {
  if (typeof type === 'undefined') {
    throw this.error('getLoaderInstance', 'expects a string or object.', type);
  }
  if (typeof type === 'string') return this._.loaders[type];
  return this._.loaders[type.loaderType || 'sync'];
};

/**
 * Build an array of loader functions from an array that contains a
 * mixture of cached loader names and functions.
 *
 * @param  {String} `type` The loader type: async, sync, promise or stream, used to get cached loaders.
 * @param  {Array} `stack`
 * @return {Array}
 * @api public
 */

Template.prototype.buildStack = function(type, stack) {
  this.assert('buildStack', 'type', 'string', type);
  if (!stack || stack.length === 0) return [];
  stack = flatten(stack);
  var len = stack.length, i = -1;
  var res = [];
  while (i < len) {
    var name = stack[++i];
    var cache = this.loaders[type];
    if (!name) continue;
    res.push(cache[name] || name);
  }
  return flatten(res);
};

/**
 * Private method for setting and mapping the plural name
 * for a view collection.
 *
 * @param  {String} `name`
 * @return {String}
 */

Template.prototype.inflect = function(name) {
  return this.inflections[name] || (this.inflections[name] = inflect(name));
};

/**
 * Private method for setting view types for a collection.
 *
 * @param {String} `plural` e.g. `pages`
 * @param {Object} `options`
 * @api private
 */

Template.prototype.setType = function(plural, opts) {
  this.assert('setType', 'plural', 'string', plural);
  var types = utils.arrayify(opts.viewType || 'renderable');
  var len = types.length, i = 0;
  while (len--) {
    var arr = this.viewTypes[types[i++]];
    if (arr.indexOf(plural) === -1) {
      arr.push(plural);
    }
  }
  return types;
};

/**
 * Get all view collections of the given [type].
 *
 * ```js
 * var renderable = template.getViewType('renderable');
 * //=> { pages: { 'home.hbs': { ... }, 'about.hbs': { ... }}, posts: { ... }}
 * ```
 *
 * @param {String} `type` Types are `renderable`, `layout` and `partial`.
 * @api public
 */

Template.prototype.getViewType = function(type, subtypes) {
  this.assert('getViewType', 'type', 'string', type);
  var keys = typeof subtypes !== 'undefined'
    ? utils.arrayify(subtypes)
    : this.viewTypes[type];

  var len = keys.length, i = 0;
  var res = {};

  while (len--) {
    var plural = keys[i++];
    res[plural] = this.views[plural];
  }
  return res;
};

/**
 * Create a view collection with the given `name`.
 *
 * @param  {String} `name` Singular-form collection name, such as "page" or "post". The plural inflection is automatically created.
 * @param  {Object} `options`
 * @param  {Functions|Arrays} `stack` Loader stack to use for loading templates onto the collection.
 * @return {Object} `Template` for chaining
 * @api public
 */

Template.prototype.create = function(singular, options, stack) {
  this.assert('create', 'singular', 'string', singular);
  var plural = this.inflect(singular);

  var args = [].slice.call(arguments, 1);
  var opts = isObject(options) ? args.shift(): {};
  opts.viewType = this.setType(plural, opts);
  opts.inflection = singular;
  opts.collection = plural;

  this.options.views[plural] = opts;
  this.contexts.create[plural] = opts;
  stack = flatten(args);

  this.views[plural] = new Collection(opts, stack);
  this.decorate(singular, plural, opts, stack);
  return this;
};

/**
 * Private method for decorating a view collection with convience methods:
 *
 * @param  {String} `singular`
 * @param  {String} `plural`
 * @param  {Object} `options`
 * @param  {Arrays|Functions} `loaders`
 */

Template.prototype.decorate = function(singular, plural, options, stack) {
  var opts = extend({}, options, {plural: plural});
  var load = this.load(plural, opts, stack);

  this.mixin(singular, load);
  this.mixin(plural, load);

  // Add a `get` method to `Template` for `singular`
  this.mixin(utils.methodName('get', singular), function (key) {
    return this.lookup(plural, key);
  });

  // Add a `render` method to `Template` for `singular`
  this.mixin(utils.methodName('render', singular), function () {
    var args = [].slice.call(arguments);
    var file = this.lookup(plural, args.shift());
    return file.render.apply(this, args);
  });

  var isPartial = (opts.viewType || []).indexOf('partial') !== -1;

  // create default helpers
  if (this.enabled('default helpers') && isPartial) {
    // Create a sync helper for this type
    if (!this._.helpers.sync.hasOwnProperty(singular)) {
      this.defaultHelper(singular, plural);
    }
    // Create an async helper for this type
    if (!this._.helpers.async.hasOwnProperty(singular)) {
      this.defaultAsyncHelper(singular, plural);
    }
  }
};

Template.prototype.load = function(plural, opts, loaderStack) {
  return function(key, value, locals, options) {
    var args = [].slice.call(arguments);
    var idx = utils.loadersIndex(args);
    var actualArgs = idx !== -1 ? args.slice(0, idx) : args;
    var stack = idx !== -1 ? args.slice(idx) : [];
    var optsIdx = (idx === -1 ? 1 : (idx - 1));
    options = utils.isOptions(actualArgs[optsIdx])
      ? extend({}, opts, actualArgs.pop())
      : opts;

    var type = options.loaderType || 'sync';
    stack = this.buildStack(type, loaderStack.concat(stack));
    if (stack.length === 0) {
      stack = this.loaders[type]['default'];
    }
    var templates = this.views[plural].load(actualArgs, options, stack);
    return this.loadType(type, plural, templates);
  };
};

Template.prototype.loadType = function(type, collection, templates) {
  var handle = function(file, fp) {
    return this.handle('onLoad', file, this.handleError('onLoad', {path: fp}));
  }.bind(this);

  var app = this;
  if (type === 'promise') {
    return templates.then(function(obj) {
      for (var key in obj) {
        handle(app.views[collection][key], key);
      }
      return obj;
    });
  }

  if (type === 'stream') {
    return templates.pipe(through.obj(function(file, enc, cb) {
      handle(file, file.path);
      this.push(file);
      return cb();
    }));
  }

  for (var key in templates) {
    handle(this.views[collection][key], key);
  }
  return this.views[collection];
};

/**
 * Validate a template object to ensure that it has the properties
 * expected for applying layouts, choosing engines, and so on.
 *
 * @param  {String} `template` a template object
 * @api public
 */

Template.prototype.validate = function(/*template*/) {
  return validate.apply(validate, arguments);
};

/**
 * Private method for adding a non-enumerable property to Template.
 *
 * @param  {String} `name`
 * @param  {Function} `fn`
 * @return {Function}
 * @private
 */

Template.prototype.mixin = function(name, fn) {
  return Object.defineProperty(this, name, {
    configurable: true,
    enumerable: false,
    value: fn
  });
};

/**
 * Private method for setting a value on Template.
 *
 * @param  {Array|String} `prop` Object path.
 * @param  {Object} `val` The value to set.
 * @private
 */

Template.prototype._set = function(prop, val) {
  prop = utils.arrayify(prop).join('.');
  set(this, prop, val);
  return this;
};

/**
 * Middleware error handler
 *
 * @param {Object} `template`
 * @param {String} `method` name
 * @api private
 */

Template.prototype.handleError = function(method, template) {
  return function (err) {
    if (err) {
      err.reason = 'Error running ' + method + ' middleware: ' + JSON.stringify(template);
      console.error(err);
      return err;
    }
  };
};

/**
 * Expose `Template`
 */
module.exports = Template;
