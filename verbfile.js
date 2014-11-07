'use strict';

var verb = require('verb4');

verb.data('package.json');

verb.task('readme', function() {
  verb.src('.verb.md')
    .pipe(verb.dest('./'));
});

verb.task('default', ['readme']);