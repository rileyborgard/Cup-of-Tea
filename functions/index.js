
const functions = require('firebase-functions');
const express = require('express');
const engines = require('consolidate');

const app = express();
app.engine('hbs', engines.handlebars);
app.set('views', './views');
app.set('view engine', 'hbs');

const MongoClient = require('mongodb').MongoClient;
const mongoURL = "mongodb://localhost:27017/mydb";

app.get('/writeblog/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('writeblog');
});

app.get('/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('index');
});

app.post('/postblog/', (request, response) => {
    var blogObject = request.body;
    console.log(blogObject);
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("mydb");
        dbo.collection("blogs").insertOne(blogObject, (err, res) => {
            if (err) throw err;
            console.log("1 document inserted");
            db.close();
        });
    });
    response.redirect('/');
});

exports.app = functions.https.onRequest(app);
