/*
 * grunt-codepoint-open-transform
 * https://github.com/SignpostMarv/grunt-codepoint-open-transform
 *
 * Copyright (c) 2015 SignpostMarv
 * Licensed under the MIT license.
 */


module.exports = function(grunt) {
    'use strict';

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: [
                'Gruntfile.js',
                'tasks/*.js'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');

    // By default, lint and run all tests.
    grunt.registerTask('default', ['jshint']);

};
