
const functions = require('firebase-functions');
const express = require('express');
const engines = require('consolidate');

const app = express();

const exphbs = require('express-handlebars');
const hbs = exphbs.create({
    extname      :'hbs',
    layoutsDir   : './views/layouts',
    defaultLayout: 'index',
    helpers      : './views',
    partialsDir  : [
        './views'
    ]
});
app.engine('hbs', hbs.engine);
app.set('views', './views');
app.set('view engine', 'hbs');

const MongoClient = require('mongodb').MongoClient;

// To interact with local database, if you have mongodb installed:
const mongoURL = "mongodb://localhost:27017/mydb";

// Remote database, in MongoDB atlas: (Replace with real password)
// const mongoURL = "mongodb+srv://admin:<password>@cluster0.iui7x.mongodb.net/teapotdb?retryWrites=true&w=majority";

app.get('/writeblog/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('writeblog', {layout: 'index'});
});

app.get('/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('home', {layout: 'index'});
});

app.post('/postblog/', (request, response) => {
    var blogObject = request.body;
    console.log(blogObject);
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        dbo.collection("blogs").insertOne(blogObject, (err, res) => {
            if(err) throw err;
            console.log("1 blog inserted to database");
            db.close();
        });
    });
    response.redirect('/');
});

exports.app = functions.https.onRequest(app);
