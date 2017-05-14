var Builder = require('systemjs-builder');

var builder = new Builder('tsout');

builder
.buildStatic('index.js', 'bin/char.js', {
    config: {
        defaultJSExtensions: true,
        packages: {
        }
    },
    globalName: 'Char',
    globalDeps: {
        "pixi.js": "PIXI"
    },
    minify: false,
    runtime: true,
    sourceMaps: true
})
.then(function () {
    console.log("Build Complete")
});