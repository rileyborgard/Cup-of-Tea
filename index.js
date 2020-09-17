
var express = require('express');
var app = express();
var server = require('http').Server(app);

const port = 3000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});
server.listen(port);
