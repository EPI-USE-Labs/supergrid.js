var express = require('express');
var app = express();
var sass = require('node-sass-middleware')

app.set('views', './views');
app.set('view engine', 'pug');

app.use(express.static('public'));
app.use(express.static('src'));

app.use(
    sass({
        src: __dirname + '/stylesheets',
        dest: __dirname + '/public',
        debug: true,
        force: true,
        response: true
    })
);

app.get('/', function (req, res) {
    res.render('index', {});
});

app.listen(3030, function () {
    console.log('Example app listening on port 3030!');
});