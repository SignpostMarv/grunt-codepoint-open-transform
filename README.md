# grunt-codepoint-open-transform

> Transforms the Ordnance Survey "Code-Point Open" data.

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-codepoint-open-transform --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-codepoint-open-transform');
```

## The "codepoint_open_transform" task

### Overview
In your project's Gruntfile, add a section named `codepoint_open_transform` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
    codepoint_open_transform: {
        options: {
            // Task-specific options go here.
        },
        your_target: {
            // Target-specific file lists and/or options go here.
        },
    },
});
```

### Options

#### options.headers
Type: `Number`
Default value: `1`

Indicates which row of headers to use (object keys in JSON files)

### Output Formats
File format is determined by the destination file suffix.

#### JSON, Object of Arrays
Destinations ending in *ooa.json* will output JSON along the following form:
```json
{
    "foo": [
        "foo 1",
        "foo 2",
        "foo 3"
    ],
    "bar": [
        "bar 1",
        "bar 2",
        "bar 3"
    ]
}
```

#### JSON, Array of Objects
**Presently this output method will generate a file that appears valid,**
** however, the output file will likely trigger memory constraints**
** due to the 1.47 million objects in the array.**
Destinations ending in *aoo.json* will output JSON along the following form:
```json
[
    {
        "foo": "foo 1",
        "bar": "bar 1"
    },
    {
        "foo": "foo 2",
        "bar": "bar 2"
    },
    {
        "foo": "foo 3",
        "bar": "bar 3"
    }
]
```

### Usage Example
```js
grunt.initConfig({
    codepoint_open_transform: {
        default: {
            files: {
                'dist/codepoint-open-test.ooa.json': 'lib/codepo_gb.zip'
            }
        }
    },
});
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
