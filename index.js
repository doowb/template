/*!
 * template <https://github.com/jonschlinkert/template>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert, Brian Woodward.
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');
var chalk = require('chalk');
var async = require('async');
var cloneDeep = require('clone-deep');
var extend = require('extend-shallow');
var flatten = require('arr-flatten');
var relative = require('relative');
var layouts = require('layouts');
var pickFrom = require('pick-from');
var routes = require('en-route');
var slice = require('array-slice');
var typeOf = require('kind-of');
var tutil = require('template-utils')._;

/**
 * Extend Template
 */

var Config = require('config-cache');
var Engines = require('engine-cache');
var Helpers = require('helper-cache');
var Loaders = require('loader-cache');
var Options = require('option-cache');
var Router = routes.Router;

/**
 * Local modules
 */

var transforms = require('./lib/transforms');
var validate = require('./lib/validate');
var loaders = require('./lib/loaders');
var debug = require('./lib/debug');
var utils = require('./lib');

/**
 * Create a new instance of `Template`, optionally passing
 * default `options` to initialize with.
 *
 * ```js
 * var Template = require('template');
 * var template = new Template();
 * ```
 *
 * @class `Template`
 * @param {Object} `options` Options to initialize with.
 * @api public
 */

function Template(options) {
  Options.call(this, options);
  Config.call(this, options);
  this.initTemplate(options);
}

Config.extend(Template.prototype);
extend(Template.prototype, Options.prototype);
Template.extend = Config.extend;

/**
 * Extend `Template`
 */

Template.extend = Config.extend;
Template.Router = routes.Router;
Template.Route = routes.Route;

/**
 * Initialize defaults.
 */

Template.prototype.initTemplate = function() {
  this.loaders = this.loaders || {};
  this.engines = this.engines || {};
  this.inflections = {};
  this.errorsList = [];
  this.transforms = {};

  // Engine-related
  this._ = this._ || {};

  // View types (categories)
  this.type = {};
  this.type.partial = [];
  this.type.renderable = [];
  this.type.layout = [];

  // context object for partials
  this.set('_context', {});

  // View collections
  this.views = {};

  // defaults
  this.defaultConfig();
  this.defaultOptions();
  this.forwardLoaders();
  this.defaultLoaders();
  this.defaultTransforms();
};

/**
 * Initialize the default configuration.
 */

Template.prototype.defaultConfig = function() {
  this._.loaders = new Loaders(this.loaders);
  this._.engines = new Engines(this.engines);
  this._.helpers = new Helpers({bind: false});
  this._.asyncHelpers = new Helpers({bind: false});
};

/**
 * Initialize default options.
 */

Template.prototype.defaultOptions = function() {
  this.enable('silent');

  // defaults
  this.enable('default routes');
  this.enable('default engines');
  this.enable('default helpers');
  this.option('router methods', []);

  // engines
  this.option('view engine', '*');
  this.disable('debugEngine');

  this.engine('.*', function noop(str, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts; opts = {};
    }
    cb(null, str);
  });

  // layouts
  this.option('defaultLayout', null);
  this.option('layoutDelims', ['{%', '%}']);
  this.option('layoutTag', 'body');
  this.option('layoutExt', null);
  this.option('layout', null);

  // partials
  this.enable('mergePartials');

  // context
  this.disable('preferLocals');

  // Custom function for all other template keys
  this.option('renameKey', function (fp) {
    return path.basename(fp);
  });

  // Custom function for getting a loader
  this.option('matchLoader', function () {
    return 'default';
  });
};

/**
 * Forward methods from [loader-cache] onto `Template.prototype`:
 *   | .loader
 *   | .loaderAsync
 *   | .loaderPromise
 *   | .loaderStream
 *   | .load
 *   | .loadAsync
 *   | .loadPromise
 *   | .loadStream
 */

Template.prototype.forwardLoaders = function() {
  var mix = utils.forward(Template.prototype, this._.loaders);
  mix('loader', 'register');
  mix('loaderAsync', 'registerAsync');
  mix('loaderPromise', 'registerPromise');
  mix('loaderStream', 'registerStream');
  mix('load');
  mix('loadAsync');
  mix('loadPromise');
  mix('loadStream');
};

/**
 * Register default loader methods
 */

Template.prototype.defaultLoaders = function() {
  this.loader('default', loaders.templates(this));
  this.loader('helpers', loaders.helpers(this));
};

/**
 * Load default transforms.
 */

Template.prototype.defaultTransforms = function() {
  this.transform('routes', transforms.middleware);
  this.transform('templates', transforms.templates);
};

/**
 * Set an error message that will either `throw`, or be pushed onto
 * `errorsList` when `silent` is enabled.
 *
 * ```js
 * this.error('Error parsing string.');
 * ```
 *
 * @param {String} `methodName` The name of the method where the error is thrown.
 * @param {String} `msg` Message to use in the Error.
 * @param {Object} `file` The `value` of a template object
 * @api public
 */

Template.prototype.error = function(methodName, msg, file) {
  var filepath = (file && file.path) ? relative(file.path) : '';
  var message = ('Template#' + methodName)
    + ':' + filepath
    + ':' + msg;

  var err = new Error(message);
  err.path = filepath;
  err.reason = msg;

  console.log(chalk.yellow(err));
  if (this.enabled('silent')) {
    this.errorsList.push(err);
  } else {
    throw err;
  }
};

/**
 * Assign transform `fn` to `name` or return the value of `name`
 * if no other arguments are passed.
 *
 * Transforms are run immediately during init, and are used to
 * extend or modify the `cache.data` object, but really anything
 * on the `this` object can be tranformed.
 *
 * ```js
 * template.transform('username', function(app) {
 *   var url = app.cache.data.author.url.split('/');
 *   app.cache.data.username = url[2];
 * });
 * ```
 *
 * @param {String} `name` The name of the transform to add.
 * @param {Function} `fn` The actual transform function.
 * @return {Object} Returns `Template` for chaining.
 * @api public
 */

Template.prototype.transform = function(name, fn) {
  debug.transform('.transform: ', arguments);
  if (arguments.length === 1) {
    return this.transforms[name];
  }
  if (fn && typeof fn === 'function') {
    this.transforms[name] = fn;
    fn.call(this, this);
  }
  return this;
};

/**
 * Lazily initalize router, to allow options to
 * be passed in after init.
 */

Template.prototype.lazyrouter = function() {
  if (!this.router) {
    this.router = new Router({
      caseSensitive: this.enabled('case sensitive routing'),
      strict: this.enabled('strict routing'),
      methods: utils.methods.concat(this.option('router methods'))
    });
  }
};

/**
 * Dispatch `file` through its middleware stack
 *
 * @param {String} `method` method to dispatch files to (undefined will dispatch to `all`)
 * @param  {Object} `file` File object to be passed through the middleware stack
 * @api private
 */

Template.prototype.handle = function(method, file, done) {
  debug.routes('.handle: ', arguments);
  if (typeof method === 'object') {
    done = file; file = method; method = null;
  }
  file.options = file.options || {};
  file.options.method = method;
  if (!this.router) {
    debug.routes('no routes defined on engine');
    return done();
  }
  this.router.handle(file, done);
};

/**
 * Dispatch `file` through an array of middleware functions.
 *
 * @param  {Object} `file`
 * @param  {Array} `fns`
 * @api private
 */

Template.prototype.dispatch = function(method, file, fns) {
  for (var key in file) {
    if (file.hasOwnProperty(key)) {
      var value = file[key];
      if (fns) this.route(value.path).all(fns);
      this.handle(method, value, handleError(method, {path: key}));
    }
  }
};

/**
 * Proxy to the engine `Router#route`
 * Returns a new `Route` instance for the `path`.
 *
 * Routes are isolated middleware stacks for specific paths.
 * See the `Route` api docs for details.
 *
 * @param {String} `path`
 * @api public
 */

Template.prototype.route = function(path) {
  debug.routes('route: %s', path);
  this.lazyrouter();
  return this.router.route(path);
};

/**
 * Proxy to `Router#param` with one added api feature. The `name` parameter
 * can be an array of names.
 *
 * See the `Router#param` docs for more details.
 *
 * @param {String|Array} `name`
 * @param {Function} `fn`
 * @return {Object} `Template` for chaining
 * @api public
 */

Template.prototype.param = function(name, fn) {
  debug.routes('param: %s', name);
  this.lazyrouter();
  if (Array.isArray(name)) {
    var len = name.length, i = 0;
    while (len--) this.param(name[i++], fn);
    return this;
  }
  this.router.param(name, fn);
  return this;
};

/**
 * Proxy to `Router#use` to add middleware to the engine router.
 * See the `Router#use` documentation for details.
 *
 * If the `fn` parameter is an engine, then it will be
 * mounted at the `route` specified.
 *
 * ```js
 * template.use(/\.md$/, function (file, next) {
 *   // do stuff next();
 * });
 * ```
 *
 * @param {Function} `fn`
 */

Template.prototype.use = function (fn) {
  var offset = 0, path = '/';
  // default path to '/'
  if (typeof fn !== 'function') {
    var arg = fn;
    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0];
    }
    // if the first arg is the path, offset by 1
    if (typeof arg !== 'function') {
      offset = 1;
      path = fn;
    }
  }

  var fns = flatten(slice(arguments, offset));
  if (fns.length === 0) {
    this.error('use', 'expects middleware functions: ' + JSON.stringify(arguments));
  }

  this.lazyrouter();
  var router = this.router;
  var len = fns.length, i = 0;

  while (len--) {
    var mfn = fns[i++];
    // non-Template instance
    if (!mfn || !mfn.handle || !mfn.set) {
      router.use(path, mfn.bind(this));
    }
    debug.routes('use: %s', path);
    mfn.mountpath = path;
    mfn.parent = this;
  }
  return this;
};

/**
 * Delegate `.METHOD(...)` calls to `router.METHOD(...)`
 *
 * @param {String} `path`
 * @param {Function} Callback
 * @return {Object} `Template` for chaining
 * @api public
 */

utils.methods.forEach(function(method) {
  Template.prototype[method] = function(path) {
    debug.routes('%s: %s', method, path);
    this.lazyrouter();

    var route = this.router.route(path);
    var len = arguments.length - 1;
    var args = new Array(len);

    for (var i = 0; i < len; i++) {
      args[i] = arguments[i + 1];
    }

    route[method].apply(route, args);
    return this;
  };
});

/**
 * Special-cased "all" method, applying the given route `path`,
 * middleware, and callback.
 *
 * ```js
 * template.all(/\.md$/, function (file, next) {
 *   // do stuff next();
 * });
 * ```
 *
 * @param {String} `path`
 * @param {Function} `callback`
 * @return {Object} `Template` for chaining
 * @api public
 */

Template.prototype.all = function(path) {
  debug.routes('all: %s', path);
  this.lazyrouter();
  var route = this.router.route(path);
  var len = arguments.length - 1;
  var args = new Array(len);

  for (var i = 0; i < len; i++) {
    args[i] = arguments[i + 1];
  }
  route.all.apply(route, args);
  return this;
};

/**
 * If a layout is defined, apply it. Otherwise just return the content as-is.
 *
 * @param  {String} `ext` The layout settings to use.
 * @param  {Object} `template` Template object, with `content` to be wrapped with a layout.
 * @return  {String} Either the string wrapped with a layout, or the original string if no layout was found.
 * @api private
 */

Template.prototype.applyLayout = function(template, locals) {
  debug.layout('applying layout: %j', arguments);

  if (typeOf(template) !== 'object') {
    this.error('applyLayout', 'expects an object.', template);
  }

  // If a layout has already been applied, return the content
  if (template.options.layoutApplied) {
    return template.content;
  }

  template.options.layoutApplied = true;
  if (template.options.isPartial) {
    locals.defaultLayout = false;
  }

  // Get the name of the (starting) layout to be used
  var layout = template.layout
    || template.data && template.data.layout
    || locals && locals.layout
    || template.options && template.options.layout
    || template.locals && template.locals.layout;

  // If `layoutExt` is defined on the options, append
  // it to the layout name before passing the name to [layouts]
  var ext = this.option('layoutExt');
  if (ext) {
    layout += (ext ? tutil.formatExt(ext) : '');
  }

  // Merge `layout` collections based on settings
  var stack = this.mergeLayouts(locals);
  var res = layouts(template.content, layout, stack, locals);
  template.options.layoutStack = res;
  return res.result;
};

/**
 * Private method for registering an engine. Register the given view
 * engine callback `fn` as `ext`.
 *
 * @param {String} `ext`
 * @param {Function|Object} `fn` or `options`
 * @param {Object} `options`
 * @return {Object} `Template` to enable chaining
 * @api private
 */

Template.prototype.registerEngine = function(ext, fn, options) {
  debug.engine('.registerEngine:', arguments);
  var opts = extend({}, options);
  ext = tutil.formatExt(ext);
  this._.engines.setEngine(ext, fn, opts);
  return this;
};

/**
 * Register the given view engine callback `fn` as `ext`. If only `ext`
 * is passed, the engine registered for `ext` is returned. If no `ext`
 * is passed, the entire cache is returned.
 *
 * @doc api-engine
 * @param {String|Array} `exts` File extension or array of extensions.
 * @param {Function|Object} `fn` or `options`
 * @param {Object} `options`
 * @return {Object} `Template` to enable chaining
 * @api public
 */

Template.prototype.engine = function(exts, fn, opts) {
  debug.engine('.engine:', arguments);
  exts = utils.arrayify(exts);
  var len = exts.length;
  while (len--) this.registerEngine(exts[len], fn, opts);
  return this;
};

/**
 * Get the engine settings registered for the given `ext`.
 *
 * ```js
 * template.getEngine('.html');
 * ```
 *
 * @doc api-getEngine
 * @param {String} `ext` The engine to get.
 * @return {Object} Object with methods and settings for the specified engine.
 * @api public
 */

Template.prototype.getEngine = function(ext) {
  debug.engine('.getEngine: %s', ext);
  ext = ext || this.option('view engine');
  return this._.engines.getEngine(ext);
};

/**
 * Register generic template helpers that can be used with any engine.
 *
 * Helpers registered using this method will be passed to every
 * engine, so this method is best for generic javascript functions -
 * unless you want to see Lo-Dash blow up from `Handlebars.SafeString`.
 *
 * ```js
 * template.helper('lower', function(str) {
 *   return str.toLowerCase();
 * });
 * ```
 *
 * @param {String} `key` Helper name
 * @param {Function} `fn` Helper function.
 * @api public
 */

Template.prototype.helper = function(name, fn) {
  debug.helper('adding helper: %s', name);
  this._.helpers.addHelper(name, fn);
  return this;
};

/**
 * Register multiple helpers.
 *
 * ```js
 * template.addHelpers({
 *   a: function() {},
 *   b: function() {},
 *   c: function() {},
 * });
 * ```
 *
 * @param {Object|Array} `helpers` Object, array of objects, or glob patterns.
 * @api public
 */

Template.prototype.helpers = function(helpers, options) {
  debug.helper('adding helpers: %s', helpers);
  options = options || {};

  options.matchLoader = function () {
    return 'helpers';
  };

  this._.helpers.addHelpers(this.load(helpers, options));
  return this;
};

/**
 * Register generic async template helpers that are not specific to an
 * engine.
 *
 * As with the sync version, helpers registered using this method will
 * be passed to every engine, so this method is best for generic
 * javascript functions.
 *
 * ```js
 * template.asyncHelper('lower', function(str, next) {
 *   str = str.toLowerCase();
 *   next();
 * });
 * ```
 *
 * @param {String} `name` Helper name.
 * @param {Function} `fn` Helper function
 * @api public
 */

Template.prototype.asyncHelper = function(name, fn) {
  debug.helper('adding async helper: %s', name);
  this._.asyncHelpers.addAsyncHelper(name, fn);
  return this;
};

/**
 * Register multiple async helpers.
 *
 * ```js
 * template.addAsyncHelpers({
 *   a: function() {},
 *   b: function() {},
 *   c: function() {},
 * });
 * ```
 *
 * @param {Object|Array} `helpers` Object, array of objects, or glob patterns.
 * @api public
 */

Template.prototype.asyncHelpers = function(helpers, options) {
  debug.helper('adding async helpers: %s', helpers);
  options = options || {};
  options.matchLoader = function () {
    return 'helpers';
  };
  this._.asyncHelpers.addAsyncHelpers(this.load(helpers, options));
  return this;
};

/**
 * Register an object of helpers for the given `ext` (engine).
 *
 * ```js
 * template.helpers(require('handlebars-helpers'));
 * ```
 *
 * @param {String} `ext` The engine to register helpers with.
 * @return {Object} Object of helpers for the specified engine.
 * @api public
 */

Template.prototype.engineHelpers = function(ext) {
  debug.helper('helpers for engine: %s', ext);
  return this.getEngine(ext).helpers;
};

/**
 * Create helpers for each default template `type`.
 *
 * @param {String} `type` The type of template.
 * @param {String} `plural` Plural form of `type`.
 * @api private
 */

Template.prototype.defaultHelper = function(subtype, plural) {
  debug.helper('default helper: %s', subtype);
  var self = this;

  this.helper(subtype, function (key, locals) {
    debug.helper('sync helper %s: %j', key, arguments);
    var partial = self.views[plural][key];

    if (typeOf(partial) !== 'object') {
      var message =  'cannot find {{' + subtype + ' "' + key + '"}}';
      self.error('defaultHelper ' + subtype, message);
    }

    var locs = extend({}, this.context, locals);
    var content = self.renderTemplate(partial, locs);
    if (content instanceof Error) {
      throw content;
    }
    return content;
  });
};

/**
 * Create async helpers for each default template `type`.
 *
 * @param {String} `type` The type of template.
 * @param {String} `plural` Plural form of `type`.
 * @api private
 */

Template.prototype.defaultAsyncHelper = function(subtype, plural) {
  debug.helper('default async helper: %s', subtype);
  var self = this;

  this.asyncHelper(subtype, function (key, locals, cb) {
    debug.helper('async helper %s: %j', key, arguments);

    var last = arguments[arguments.length - 1];
    if (typeof locals === 'function') {
      cb = locals;
      locals = {};
    }

    if (typeof cb !== 'function') {
      cb = last;
    }

    var partial = self.views[plural][key];
    if (typeOf(partial) !== 'object') {
      var message =  'cannot find {{' + subtype + ' "' + key + '"}}';
      self.error('defaultAsyncHelper ' + subtype, message);
      return cb(null, '');
    }

    var locs = extend({}, this.context, locals);
    var render = self.renderSubtype(subtype);

    render(key, locs, function (err, content) {
      if (err) return cb(err);
      cb(null, content);
      return;
    });
  });
};

/**
 * Create a load method for the specified template type.
 * The load method runs the loader stack for the specified template type then
 * normalizes and validates the results and adds them to the template cache.
 *
 * @param  {String} `subtype` Template type to use
 * @param  {String} `plural`  Plural name of the template type to use
 * @param  {Object} `options` Additional options to pass to normalize
 * @return {Function} Method for loading templates of the specified type
 * @api private
 */

Template.prototype._load = function(subtype, plural, options) {
  var opts = extend({}, options);
  var type = opts.load || 'sync';

  return function (/*args, stack, options*/) {
    var self = this;
    var stack = [];

    // Default method used to handle sync loading when done
    var cb = function (err, template) {
      if (err) this.error('_load', err, template);
      return template;
    };

    var len = arguments.length;
    var args = new Array(len);

    for (var i = 0; i < len; i++) {
      var arg = arguments[i];

      if (i !== 0 && typeOf(arg) === 'array') {
        stack = arg;
        args.pop();
        continue;
      } else if (i === len - 1 && typeOf(arg) === 'function') {
        if (type !== 'async') {
          this.error('_load callback', subtype + ' loaders are not async.');
        }
        cb = arg;
        args.pop();
        continue;
      }
      args[i] = arg;
    }

    if (args.length === 1) args = args[0];

    var loadOpts = {};
    loadOpts.matchLoader = function () {
      return subtype;
    };

    /**
     * Default done function for normalization, validation,
     * and extending the views when finished loading
     */
    function done(err, template) {
      if (err) return cb(err);
      template = self.normalize(subtype, plural, template, options);
      // validate the template object before moving on
      self.validate(template);
      // Add template to the cache
      extend(self.views[plural], template);
      return cb(null, template);
    }

    // Choose loaders based on loader type
    switch (type) {
      case 'async':
        self.loadAsync(args, stack, loadOpts, done);
        break;
      case 'promise':
        return self.loadPromise(args, stack, loadOpts)
          .then(function (template) {
            return done(null, template);
          });
      case 'stream':
        return self.loadStream(args, stack, loadOpts)
          .on('data', function (template) {
            done(null, template);
          })
          .on('error', done);
      default:
        return done(null, self.load(args, stack, loadOpts));
    }
  };
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
 * Normalize a template object to ensure it has the necessary
 * properties to be rendered by the current renderer.
 *
 * @param  {Object} `template` The template object to normalize.
 * @param  {Object} `options` Options to pass to the renderer.
 *     @option {Function} `renameKey` Override the default function for renaming
 *             the key of normalized template objects.
 * @return {Object} Normalized template.
 * @api private
 */

Template.prototype.normalize = function(subtype, plural, template, options) {
  debug.template('normalizing: [%s]: %j', plural, template);
  this.lazyrouter();

  if (this.option('normalize')) {
    return this.options.normalize.apply(this, arguments);
  }

  var opts = cloneDeep(options || {});
  opts.subtype = subtype;
  opts.collection = plural;

  for (var key in template) {
    if (template.hasOwnProperty(key)) {
      var file = template[key];

      file.contexts = file.contexts || {};
      file.options = extend({}, opts, file.options);
      file.contexts.create = opts;
      file.options.create = opts;

      this.handle('onLoad', file, handleError('onLoad', {path: key}));

      // Add a render method to the template
      template[key] = file;
    }
  }
  return template;
};

/**
 * Private method for tracking the `subtypes` created for each
 * template collection type, to make it easier to get/set templates
 * and pass them properly to registered engines.
 *
 * @param {String} `plural` e.g. `pages`
 * @param {Object} `options`
 * @api private
 */

Template.prototype.setType = function(subtype, plural, options) {
  debug.template('setting subtype: %s', subtype);
  var opts = extend({}, options);

  // Make an association between `subtype` and its `plural`
  this.inflections[subtype] = plural;
  if (opts.isRenderable && this.type.renderable.indexOf(plural) === -1) {
    this.type.renderable.push(plural);
  }

  if (opts.isLayout && this.type.layout.indexOf(plural) === -1) {
    this.type.layout.push(plural);
  }

  if (opts.isPartial || (!opts.isRenderable && !opts.isLayout)) {
    if (this.type.partial.indexOf(plural) === -1) {
      this.type.partial.push(plural);
    }
    opts.isPartial = true;
  }
  return opts;
};

/**
 * Private method for registering a loader stack for a specified
 * template type.
 *
 * @param {String} `subtype` template type to set loader stack for
 * @param {Object} `options` additional options to determine the loader type
 * @param {Array}  `stack` loader stack
 */

Template.prototype.setLoaders = function(subtype, options, stack) {
  options = options || {};
  var type = options.load || 'sync';

  if (this._.loaders.cache[type] && this._.loaders.cache[type][subtype]) {
    delete this._.loaders.cache[type][subtype];
  }
  if (stack.length === 0) {
    stack.push(['default']);
  }

  var loader = 'loader';
  if (type !== 'sync') {
    loader = utils.methodName('loader', type);
  }

  this[loader].apply(this, [subtype].concat(stack));
};

/**
 * Get a view `collection` by its singular or plural name.
 *
 * ```js
 * var pages = template.getViews('pages');
 * //=> { pages: {'home.hbs': { ... }}
 *
 * var posts = template.getViews('posts');
 * //=> { posts: {'2015-10-10.md': { ... }}
 * ```
 *
 * @param {String} `name` Collection name.
 * @return {Object}
 * @api public
 */

Template.prototype.getViews = function(type) {
  if (!this.views.hasOwnProperty(type)) {
    type = this.inflections[type];
  }
  return this.views[type];
};

/**
 * Get a specific template from the specified collection.
 *
 * @param {String} `name` Template name
 * @param {String} `collection` Collection name
 * @return {Object}
 * @api public
 */

Template.prototype.getView = function(collection, name) {
  if (!collection) return this.error('view', 'expects a collection name.');
  var views = this.getViews(collection);
  if (!views) return null;

  if (views.hasOwnProperty(name)) {
    return views[name];
  }

  var fn = this.option('renameKey');
  if (typeof fn === 'function') {
    name = fn(name);
  }

  if (views.hasOwnProperty(name)) {
    return views[name];
  }

  this.error('view', 'cannot find: "' + name + '".');
  return null;
};

/**
 * Convenience method for finding a specific template by `name` on
 * the given collection. Optionally specify a file extension.
 *
 * @param {String} `plural` The view collection to search.
 * @param {String} `name` The name of the template.
 * @param {String} `ext` Optionally pass a file extension to append to `name`
 * @api public
 */

Template.prototype.lookup = function(collection, name, ext) {
  var views = this.getViews(collection || 'pages');
  if (views.hasOwnProperty(name)) {
    return views[name];
  }

  var idx = name.indexOf('.');
  var hasExt = idx !== -1;

  var base = hasExt ? name.slice(0, idx) : name;
  if (hasExt && views.hasOwnProperty(base)) {
    return views[base];
  }

  var key = name + (ext || '.md');
  if (views.hasOwnProperty(key)) {
    return views[key];
  }

  var fn = this.option('renameKey');
  if (typeof fn === 'function') {
    name = fn(name);
  }

  if (views.hasOwnProperty(key)) {
    return views[key];
  }

  this.error('view', 'cannot find: "' + collection + '" => "' + name + '".');
  return null;
};

/**
 * Get all view collections of the given [type].
 *
 * ```js
 * var renderable = template.getType('renderable');
 * //=> { pages: { 'home.hbs': { ... }, 'about.hbs': { ... }}, posts: { ... }}
 * ```
 *
 * @param {String} `type` Types are `renderable`, `layout` and `partial`.
 * @api public
 */

Template.prototype.getType = function(type, subtypes) {
  debug.template('getting type: %s', type);

  var keys = typeof subtypes !== 'undefined'
    ? utils.arrayify(subtypes)
    : this.type[type];

  var len = keys.length, i = 0;
  var res = {};

  while (len--) {
    var plural = keys[i++];
    res[plural] = this.views[plural];
  }
  return res;
};

/**
 * Merge all collections of the given `type` into a single
 * collection. e.g. `partials` and `includes` would be merged.
 *
 * If an array of `collections` is passed, only those collections
 * will be merged and the order in which the collections are defined
 * in the array will be respected.
 *
 * @param {String} `type` The template type to search.
 * @param {String} `subtypes` Optionally pass an array of view collection names
 * @api public
 */

Template.prototype.mergeType = function(type/*, subtypes*/) {
  debug.template('merging [type]: %s', type);
  var collections = this.getType.apply(this, arguments);
  var res = {};

  for (var key in collections) {
    if (collections.hasOwnProperty(key)) {
      var collection = collections[key];

      for (var name in collection) {
        if (!res.hasOwnProperty(name) && collection.hasOwnProperty(name)) {
          res[name] = collection[name];
        }
      }
    }
  }
  return res;
};

/**
 * Merge all `layout` collections based on user-defined options.
 *
 * @param {String} `type` The template type to search.
 * @param {String} `collections` Optionally pass an array of collections
 * @api public
 */

Template.prototype.mergeLayouts = function(fn) {
  debug.template('merging layouts: %j', fn);

  var custom = this.option('mergeLayouts');
  if (typeof custom === 'undefined') custom = fn;
  var layouts = {};

  if (typeof custom === 'function') {
    return custom.call(this, arguments);
  }

  if (Array.isArray(custom)) {
    layouts = this.mergeType('layout', custom);
  } else if (custom === false) {
    layouts = this.views.layouts;
  } else {
    layouts = this.mergeType('layout');
  }

  var mergeTypeContext = this.mergeTypeContext(this, 'layouts');
  for (var key in layouts) {
    if (layouts.hasOwnProperty(key)) {
      var value = layouts[key];
      mergeTypeContext(key, value.locals, value.data);
    }
  }
  return layouts;
};

/**
 * Default method for determining how partials are to be passed to
 * engines.
 *
 * ```js
 * template.option('mergePartials', function(locals) {
 *   // do stuff
 * });
 * ```
 *
 * @param {Object} `locals` Locals should have layout delimiters, if defined
 * @return {Object}
 * @api public
 */

Template.prototype.mergePartials = function(context) {
  debug.template('merging partials [%s]: %j', arguments);

  var mergePartials = this.option('mergePartials');
  if (typeof mergePartials === 'function') {
    return mergePartials.call(this, context);
  }

  var opts = context.options || {};
  if (mergePartials === true) {
    opts.partials = cloneDeep(context.partials || {});
  }

  var mergeTypeContext = this.mergeTypeContext(this, 'partials');
  var arr = this.type.partial;
  var len = arr.length, i = 0;

  // loop over each `partial` collection (e.g. `docs`)
  while (len--) {
    var plural = arr[i++];
    // Example `this.views.docs`
    var collection = this.views[plural];

    // Loop over each partial in the collection
    for (var key in collection) {
      if (collection.hasOwnProperty(key)) {
        var value = collection[key];
        mergeTypeContext(key, value.locals, value.data);

        // get the globally stored context that we just created
        // using `mergeTypeContext` for the current partial
        var layoutOpts = this.cache._context.partials[key];
        layoutOpts.layoutDelims = pickFrom('layoutDelims', [layoutOpts, opts]);

        // wrap the partial with a layout, if applicable
        value.content = this.applyLayout(value, layoutOpts);

        // If `mergePartials` is true combine all `partial` subtypes
        if (mergePartials === true) {
          opts.partials[key] = value.content;

        // Otherwise, each partial subtype on a separate object
        } else {
          opts[plural] = opts[plural] || {};
          opts[plural][key] = value.content;
        }
      }
    }
  }
  context.options = extend({}, context.options, opts);
  return context;
};

/**
 * Find a template based on its `type`. `.find` returns the first
 * template that matches the given `key`.
 *
 * Searches all views of [view-subtypes][subtypes] of the given [type], returning
 * the first template found with the given `key`. Optionally pass
 * an array of `subtypes` to limit the search;
 *
 * ```js
 * template.find('renderable', 'home', ['page', 'post']);
 * ```
 *
 * @param {String} `type` The template type to search.
 * @param {String} `key` The template to find.
 * @param {Array} `subtypes`
 * @api public
 */

Template.prototype.find = function(type, name, subtypes) {
  if (typeof type !== 'string') {
    this.error('find', 'expects `type` to be a string.');
  }
  if (typeof name !== 'string') {
    this.error('find', 'expects `name` to be a string.');
  }

  var collection = this.getType(type, subtypes);
  for (var key in collection) {
    if (collection.hasOwnProperty(key)) {
      var views = collection[key];
      if (views.hasOwnProperty(name)) {
        return views[name];
      }
    }
  }
  return null;
};

/**
 * Search all renderable `subtypes`, returning the first template
 * with the given `key`.
 *
 *   - If `key` is not found `null` is returned
 *   - Optionally limit the search to the specified `subtypes`.
 *
 * @param {String} `key` The template to search for.
 * @param {Array} `subtypes`
 * @api public
 */

Template.prototype.findRenderable = function(key, subtypes) {
  return this.find('renderable', key, subtypes);
};

/**
 * Search all layout `subtypes`, returning the first template
 * with the given `key`.
 *
 *   - If `key` is not found `null` is returned
 *   - Optionally limit the search to the specified `subtypes`.
 *
 * @param {String} `key` The template to search for.
 * @param {Array} `subtypes`
 * @api public
 */

Template.prototype.findLayout = function(key, subtypes) {
  return this.find('layout', key, subtypes);
};

/**
 * Search all partial `subtypes`, returning the first template
 * with the given `key`.
 *
 *   - If `key` is not found `null` is returned
 *   - Optionally limit the search to the specified `subtypes`.
 *
 * @param {String} `key` The template to search for.
 * @param {Array} `subtypes`
 * @api public
 */

Template.prototype.findPartial = function(key, subtypes) {
  return this.find('partial', key, subtypes);
};

/**
 * Create a new `view` collection and associated convience methods.
 *
 * Note that when you only specify a name for the type, a plural form is created
 * automatically (e.g. `page` and `pages`). However, you can define the
 * `plural` form explicitly if necessary.
 *
 * ```js
 * template.create('include', {isPartial: true});
 * // now you can load and use includes!
 * template.includes('*.hbs');
 * ```
 *
 * @param {String} `subtype` Singular name of the collection to create, e.g. `page`.
 * @param {String} `plural` Plural name of the collection, e.g. `pages`.
 * @param {Object} `options` Options for the collection.
 * @option {Boolean} `isRenderable` Templates that may be rendered at some point
 * @option {Boolean} `isLayout` Templates to be used as layouts
 * @option {Boolean} `isPartial` Templates to be used as partial views or includes
 * @param {Function|Array} `stack` Loader function or functions to be run for every template of this type.
 * @return {Object} `Template` to enable chaining.
 * @api public
 */

Template.prototype.create = function(subtype, plural, opts/*, stack*/) {
  debug.template('creating subtype: %s', subtype);
  var len = arguments.length;
  var args = new Array(len);

  for (var i = 0; i < len; i++) {
    args[i] = arguments[i];
  }

  // normalize arguments
  if (typeOf(plural) !== 'string') { args.splice(1, 0, subtype + 's'); }
  if (typeOf(args[2]) !== 'object') { args.splice(2, 0, {}); }
  plural = args[1];
  opts = args[2];

  // add an object to `views` for this template type
  this.views[plural] = this.views[plural] || {};
  opts = this.setType(subtype, plural, opts);

  // add loaders to default loaders
  this.setLoaders(subtype, opts, args.slice(3));

  // Add convenience methods for this sub-type
  this.decorate(subtype, plural, opts);

  // create default helpers
  if (this.enabled('default helpers') && opts && opts.isPartial) {
    // Create a sync helper for this type
    if (!utils.hasOwn(this._.helpers, subtype)) {
      this.defaultHelper(subtype, plural);
    }
    // Create an async helper for this type
    if (!utils.hasOwn(this._.asyncHelpers, subtype)) {
      this.defaultAsyncHelper(subtype, plural);
    }
  }
  return this;
};

/**
 * Decorate a new template subtype with convenience methods.
 * For example, the `post` template type would have `.post`
 * and `.posts` methods created.
 */

Template.prototype.decorate = function(subtype, plural, options) {
  debug.template('decorating subtype:', arguments);

  // create a loader for this template subtype
  var fn = this._load(subtype, plural, options);

  // make a `plural` convenience method, ex: `.pages`
  mixin(plural, fn);

  // make a `singular` convenience method, ex: `.page`
  mixin(subtype, fn);

  // Add a `get` method to `Template` for `subtype`
  mixin(utils.methodName('get', subtype), function (key) {
    return this.views[plural][key];
  });

  // Add a `render` method to `Template` for `subtype`
  mixin(utils.methodName('render', subtype), function () {
    return this.renderSubtype(subtype);
  });
};

/**
 * Base compile method. Use `engine` to compile `content` with the
 * given `options`
 *
 * @param  {Object} `engine` Engine object, with `.compile` method
 * @param  {Object} `content` The content string to compile.
 * @param  {Object} `options` options to pass to registered view engines.
 * @return {Function} The compiled template string.
 * @api private
 */

Template.prototype.compileBase = function(engine, content, options) {
  debug.render('compileBase:', arguments);
  if (!utils.hasOwn(engine, 'compile')) {
    this.error('compileBase', '`.compile` method not found on: "' + engine.name + '".');
  }

  try {
    return engine.compile(content, options);
  } catch (err) {
    debug.err('compile:', err);
    return err;
  }
};

/**
 * Compile content on the given `template` object with the specified
 * engine `options`.
 *
 * @param  {Object} `template` The template object with content to compile.
 * @param  {Object} `options` Options to pass along to the engine when compile. May include a `context` property to bind to helpers.
 * @return {Object} Template object to enable chaining.
 * @api public
 */

Template.prototype.compileTemplate = function(template, options, isAsync) {
  debug.render('compileTemplate: %j', template);

  if (typeOf(template) !== 'object') {
    this.error('compileTemplate', 'expects an object, but got: ' + template);
  }

  // reference to options in case helpers are needed later
  var opts = options || {};
  var context = opts.context || {};
  delete opts.context;
  opts.async = isAsync;

  // handle pre-compile middleware routes
  this.handle('preCompile', template, handleError('preCompile', template));

  // if a layout is defined, apply it before compiling
  var content = this.applyLayout(template, extend({}, context, opts));
  template.content = content;

  // handle pre-compile middleware routes
  this.handle('postCompile', template, handleError('postCompile', template));
  content = template.content;

  // Bind context to helpers before passing to the engine.
  this.bindHelpers(opts, context, isAsync);
  opts.debugEngine = this.option('debugEngine');

  // get the engine to use
  var engine = this.getEngine(template.engine);

  // compile template
  return this.compileBase(engine, content, opts);
};

/**
 * Compile `content` with the given `options`.
 *
 * @param  {Object|String} `file` String or normalized template object.
 * @param  {Object} `options`
 * @param  {Boolean} `isAsync` Load async helpers
 * @return {Function} Compiled function.
 * @api public
 */

Template.prototype.compile = function(content, options, isAsync) {
  debug.render('compile:', arguments);
  if (typeof content !== 'string' && typeOf(content) !== 'object') {
    this.error('compile', 'expects a string or object, but got: ' + content);
  }

  if (typeOf(content) === 'object') {
    return this.compileTemplate(content, options, isAsync);
  }

  var template = this.findRenderable(content);
  if (typeOf(template) === 'object') {
    return this.compileTemplate(template, options, isAsync);
  }
  return this.compileString(content, options, isAsync);
};

/**
 * Compile the given string with the specified `options`.
 *
 * The primary purpose of this method is to get the engine before
 * passing args to `.compileBase`.
 *
 * @param  {String} `str` The string to compile.
 * @param  {Object} `options` Options to pass to registered view engines.
 * @param  {Boolean} `async` Load async helpers
 * @return {Function}
 * @api public
 */

Template.prototype.compileString = function(str, options, isAsync) {
  debug.render('render string:', arguments);
  if (typeof str !== 'string') {
    this.error('compileString', 'expects a string but got: ' + str);
  }
  if (typeof options === 'boolean') {
    isAsync = options;
    options = {};
  }
  options = extend({locals: {}}, options);
  var locals = options.locals;

  var template = { content: str, locals: locals, options: options };
  return this.compileTemplate(template, options, isAsync);
};

/**
 * Base render method. Use `engine` to render `content` with the
 * given `options` and `callback`.
 *
 * @param  {Object} `engine` Engine object, with `.render` and/or `.renderSync` method(s)
 * @param  {Object} `content` The content string to render.
 * @param  {Object} `options` Locals and/or options to pass to registered view engines.
 * @param  {Function} `cb` If a callback is passed, `.render` is used, otherwise `.renderSync` is used.
 * @return {String} The rendered template string.
 * @api private
 */

Template.prototype.renderBase = function(engine, content, options, cb) {
  debug.render('renderBase:', arguments);
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  if (typeof cb !== 'function') {
    return this.renderSync(engine, content, options);
  }
  return this.renderAsync(engine, content, options, cb);
};

/**
 * Render content on the given `template` object with the specified
 * engine `options` and `callback`.
 *
 * @param  {Object} `template` The template object with content to render.
 * @param  {Object} `locals` Locals and/or options to pass to registered view engines.
 * @return {String}
 * @api public
 */

Template.prototype.renderTemplate = function(template, locals, cb) {
  debug.render('renderTemplate: %j', template);
  if (typeof locals === 'function') {
    cb = locals;
    locals = {};
  }

  if (typeOf(template) !== 'object') {
    this.error('renderTemplate', 'expects an object, got: ' + JSON.stringify(arguments));
  }

  // find any options passed in on locals
  locals = locals || {};
  template.path = template.path || '.';
  var self = this;

  // handle pre-render middleware routes
  this.handle('preRender', template, handleError('preRender', template));

  // Merge `.render` locals with template locals
  locals = this.mergeContext(template, locals);

  // shallow clone any options set on the `locals` object
  var opts = extend({}, locals.options);

  // find the engine to use for rendering templates
  var engine = this.getEngine(template.engine);
  var isAsync = typeOf(cb) === 'function';

  // compile the template if it hasn't been already
  if (typeOf(template.fn) !== 'function') {
    opts.context = opts.context || locals;
    opts.delims = engine.options.delims;
    template.fn = this.compileTemplate(template, opts, isAsync);
  }

  // for engines that don't support compile, we need to merge
  // in the `context` and `delims` for backwards compatibility
  if (typeof content === 'string') {
    locals = extend({}, locals, opts);
  }

  var content = template.fn;
  if (!isAsync) {
    template.content = this.renderBase(engine, content, locals, cb);
    // handle post-render middleware routes
    this.handle('postRender', template, handleError('postRender', template));
    return template.content;
  }

  return this.renderBase(engine, content, locals, function (err, content) {
    if (err) {
      cb.call(self, err);
      return;
    }

    // update the `content` property with the rendered result, so we can
    // pass the entire template object to the postRender middleware
    template.content = content;
    self.handle('postRender', template, handleError('postRender', template));

    // final rendered string
    return cb.call(self, null, template.content);
  });
};

/**
 * Base sync render method. Uses the given `engine` to render
 * `content` with the given `options`.
 *
 * @param  {Object} `engine` Engine object must have a `.renderSync` method.
 * @param  {Object} `content` The content string to render.
 * @param  {Object} `options` Locals and/or options to pass to registered view engines.
 * @return {String} The rendered template string.
 * @api private
 */

Template.prototype.renderSync = function(engine, content, options) {
  if (!utils.hasOwn(engine, 'renderSync')) {
    this.error('renderSync', '.renderSync method not found on engine:' + JSON.stringify(engine));
  }
  try {
    return engine.renderSync(content, options);
  } catch (err) {
    debug.err('renderSync:', err);
    return err;
  }
};

/**
 * Base async render method. Uses the given `engine` to render
 * `content` with the given `options` and `callback`.
 *
 * @param  {Object} `engine` Engine object, with `.render` and/or `.renderSync` method(s)
 * @param  {Object} `content` The content string to render.
 * @param  {Object} `options` Locals and/or options to pass to registered view engines.
 * @param  {Function} `cb` If a callback is passed, `.render` is used, otherwise `.renderSync` is used.
 * @return {String} The rendered template string.
 * @api private
 */

Template.prototype.renderAsync = function(engine, content, options, cb) {
  if (!utils.hasOwn(engine, 'render')) {
    this.error('renderAsync', 'no .render method found on engine:' + JSON.stringify(engine));
  }
  try {
    var self = this;
    engine.render(content, options, function (err, res) {
      if (err) {
        debug.render('renderAsync:', err);
        cb.call(self, err);
        return;
      }
      cb.call(self, null, res);
    });
  } catch (err) {
    debug.err('renderAsync [catch]:', err);
    cb.call(self, err);
  }
};

/**
 * Render `content` with the given `options` and optional `callback`.
 *
 * @param  {Object|String} `file` String or normalized template object.
 * @param  {Object} `locals` Locals and/or options to pass to registered view engines.
 * @return {String} Rendered string.
 * @api public
 */

Template.prototype.render = function(content, locals, cb) {
  debug.render('render:', arguments);
  if (content == null) {
    this.error('render', 'expects a string or object, got: ' + JSON.stringify(arguments));
  }
  if (typeOf(content) === 'object') {
    return this.renderTemplate(content, locals, cb);
  }
  var template = this.findRenderable(content);
  if (typeOf(template) === 'object') {
    return this.renderTemplate(template, locals, cb);
  }
  return this.renderString(content, locals, cb);
};

/**
 * Render the given string with the specified `locals` and `callback`.
 *
 * The primary purpose of this method is to get the engine before
 * passing args to `.renderBase`.
 *
 * @param  {String} `str` The string to render.
 * @param  {Object} `locals` Locals and/or options to pass to registered view engines.
 * @return {String}
 * @api public
 */

Template.prototype.renderString = function(str, locals, cb) {
  debug.render('render string: %s', str);
  if (typeof str === 'undefined') {
    var args = JSON.stringify([].slice.call(arguments));
    this.error('renderString', 'expects a string, but got: ' + args);
  }
  if (typeof locals === 'function') {
    cb = locals;
    locals = {};
  }
  locals = extend({options: {}}, locals);
  var options = locals.options || {};

  var template = { content: str, locals: locals, options: options };
  return this.renderTemplate(template, locals, cb);
};

/**
 * Returns a render function for rendering templates of the given `subtype`.
 *
 * Mostly used internally as a private method, but it's exposed as a
 * public method since there are cases when it might be useful, like
 * for rendering templates in a gulp/grunt/assemble plugin.
 *
 * @param  {String} `plural` Template subtype, e.g. `pages`
 * @return {Function} `params`
 *   @param  {String} [params] `str` The string to render.
 *   @param  {Object} [params] `locals` Locals and/or options to pass to registered view engines.
 *   @return {String} [params] `string` The rendered string.
 * @api public
 */

Template.prototype.renderSubtype = function(subtype) {
  debug.render('render subtype: [%s / %s]', subtype);
  if (typeof subtype === 'undefined') {
    this.error('renderSubtype', 'expects subtype to be a string.');
  }

  // get the plural name of the given subtype
  var plural = this.inflections[subtype];
  var self = this;

  return function (key, locals, cb) {
    debug.render('rendering subtype:', arguments);
    if (typeof locals === 'function') {
      cb = locals;
      locals = {};
    }

    // Return the first matching template from a `renderable` subtype
    var template = self.lookup(plural, key);
    if (!template) {
      this.error('renderSubtype', 'cannot find "' + subtype + ' > ' + key + '".');
    }
    return self.renderTemplate(template, locals, cb);
  };
};

/**
 * Render the given string with the specified `locals` and `callback`.
 *
 * @param  {String} `str` The string to render.
 * @param  {Object} `locals` Locals and/or options to pass to registered view engines.
 * @return {String}
 * @api public
 */

Template.prototype.renderType = function(type, subtype) {
  debug.render('render type: [%s / %s]', type, subtype);
  var self = this;

  return function (key, locals, cb) {
    debug.render('rendering type:', arguments);
    if (typeof locals === 'function') {
      cb = locals;
      locals = {};
    }

    var template = self.find(type, key, subtype);
    if (!template) {
      this.error('renderType', 'cannot find template: `' + key + '`.');
    }
    return self.renderTemplate(template, locals, cb);
  };
};

/**
 * Render each item in a collection.
 *
 * ```js
 * template.renderEach('pages', function(err, res) {
 *   //=> array of rendered pages (strings)
 * });
 * ```
 *
 * @param  {String} `collection` The name of the collection to render.
 * @param  {Object} `locals` Locals object and/or options to pass to the engine as context.
 * @return {Array} Array of rendered strings.
 * @api public
 */

Template.prototype.renderEach = function(collection, locals, cb) {
  if (typeof locals === 'function') {
    cb = locals;
    locals = {};
  }

  if (!this.views.hasOwnProperty(collection)) {
    this.error('renderEach', 'collection `' + collection + '` does not exist.');
  }

  var view = this.views[collection];
  var keys = Object.keys(view);
  var self = this;

  async.map(keys, function (key, next) {
    var file = view[key];
    self.render(file, locals, function (err, content) {
      if (err) return next(err);

      file.content = content;
      next(null, file);
    });
  }, cb);
};

/**
 * Expose the current context as `this` in helpers.
 *
 *   - Exposes `locals` on the `context` property
 *   - Exposes `Template` on the `app` property
 *
 * @param  {Object} `options` Additional options that may contain helpers
 * @param  {Object} `context` Used as the context to bind to helpers
 * @param  {Boolean} `isAsync` Pass `true` if the helper is async.
 * @return {Object}
 */

Template.prototype.bindHelpers = function (options, context, isAsync) {
  debug.helper('binding helpers: %j %j', context, options);

  var helpers = {};
  extend(helpers, this.options.helpers);
  extend(helpers, this._.helpers);
  extend(helpers, this._.imports);

  if (isAsync) {
    extend(helpers, this._.asyncHelpers);
  }
  extend(helpers, options.helpers);

  var o = {};
  o.options = extend({}, this.options, options);
  o.context = context || {};
  o.app = this;

  options.helpers = utils.bindAll(helpers, o);
};

/**
 * Build the context to be passed to templates. This can be
 * overridden by passing a function to the `mergeContext`
 * option.
 *
 * ```js
 * template.option('mergeContext', function(template, locals) {
 *   return extend(template.data, template.locals, locals);
 * });
 * ```
 *
 * @param  {Object} `template` Template object
 * @param  {Object} `locals`
 * @return {Object} The object to be passed to engines/templates as context.
 */

Template.prototype.mergeContext = function(template, locals) {
  if (typeof this.option('mergeContext') === 'function') {
    return this.option('mergeContext').apply(this, arguments);
  }

  var context = {};
  extend(context, this.cache.data);
  extend(context, template.options);

  // control the order in which `locals` and `data` are extendd
  if (this.enabled('preferLocals')) {
    extend(context, template.data);
    extend(context, template.locals);
  } else {
    extend(context, template.locals);
    extend(context, template.data);
  }

  // Partial templates to pass to engines
  extend(context, this.mergePartials(locals));

  // Merge in `locals/data` from templates
  extend(context, this.cache._context.partials);
  return context;
};

/**
 * Build the context for a specific template and type.
 *
 * ```js
 * template.mergeTypeContext('partials', 'sidenav', locals, data);
 * ```
 *
 * @param  {String} `type` Template type to merge
 * @param  {String} `key` Key of template to use
 * @param  {Object} `locals` Locals object from template
 * @param  {Object} `data` Data object from template
 * @api private
 */

Template.prototype.mergeTypeContext = function (app, type) {
  return function(key, locals, data) {
    app.cache._context[type] = app.cache._context[type] || {};
    app.cache._context[type][key] = extend({}, locals, data);
  };
};

/**
 * Middleware error handler
 *
 * @param {Object} `template`
 * @param {String} `method` name
 * @api private
 */

function handleError(method, template) {
  return function (err) {
    if (err) {
      console.error(chalk.red('Error running ' + method + ' middleware for', template.path));
      console.error(chalk.red(err));
    }
  };
}

/**
 * Extend the `Template` prototype with a new method.
 *
 * @param  {String} `method` The method name.
 * @param  {Function} `fn`
 * @api private
 */

function mixin(method, fn) {
  Template.prototype[method] = fn;
}

/**
 * Expose `Template`
 */

module.exports = Template;
