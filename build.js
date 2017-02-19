var Builder = require('systemjs-builder');

var builder = new Builder('src');

builder
.buildStatic('index.js', 'bin/char.js', {
    config: {
        defaultJSExtensions: false,
        packages: {
        }
    },
    globalName: 'Char',
    globalDeps: {
        "pixi": "PIXI"
    },
    minify: false,
    runtime: true,
    sourceMaps: true
})
.then(function () {
    console.log("Build Complete")
});