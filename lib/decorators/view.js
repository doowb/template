'use strict';

var lazy = require('lazy-cache')(require);
var mixins = require('../mixins/view');

/**
 * Decorate a new view object with app specific overrides
 *
 * ```
 * function MyView () {
 *   View.applye(this, arguments);
 * }
 *
 * View.extend(MyView);
 *
 * decorate(app, MyView);
 * ```
 *
 * @param  {Object} `app` Application instance to use
 * @param  {Function} `View` View constructor to add methods to
 */

module.exports = function (collection, view) {
  view.define('app', collection.app);
  view.define('collection', collection);

  mixins(view);
  view.defineOption('route', view.options.route);

  // handle `onLoad` middleware routes
  view.app.handleView('onLoad', view, view.locals);
  view.ctx('locals', view.locals);
  view.ctx('data', view.data);
};
