var pug = require('pug');
var sass = require('node-sass');
var fs = require('fs');
var async = require('async');

function generateStylesheet(inFilename, outFilename, callback) {
    async.waterfall([
        async.apply(sass.render, {file: inFilename}),
        function (input, callback) {callback(null, input.css);},
        async.apply(fs.writeFile, outFilename)
    ], callback);
}

function generateView(inFilename, outFilename, callback) {
    async.waterfall([
        function (callback) { callback(null, pug.renderFile(inFilename)); },
        async.apply(fs.writeFile, outFilename)
    ], callback);
}

async.parallel([
    async.apply(generateView, 'views/index.pug', 'index.html'),
    async.apply(generateStylesheet, 'stylesheets/main.scss', 'css/main.css'),
    async.apply(generateStylesheet, 'stylesheets/supergrid.scss', 'css/supergrid.css')
], function (err) {
    if (err) throw err;
    console.log('Build complete');
});