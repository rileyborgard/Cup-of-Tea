
const functions = require('firebase-functions');
const express = require('express');
const engines = require('consolidate');

const app = express();
app.engine('hbs', engines.handlebars);
app.set('views', './views');
app.set('view engine', 'hbs');

const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

// To interact with local database, if you have mongodb installed:
const mongoURL = "mongodb://localhost:27017/teapotdb";

// Remote database, in MongoDB atlas: (Replace with real password)
// const mongoURL = "mongodb+srv://admin:<password>@cluster0.iui7x.mongodb.net/teapotdb?retryWrites=true&w=majority";

app.get('/writeblog/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('writeblog');
});

app.get('/viewblogs/', (request, response) => {
	response.set('Cache-control', 'public, max-age=300, s-maxage=600');
	var arr;
	MongoClient.connect(mongoURL, (err, db) => {
		if(err) throw err;
		var dbo = db.db("teapotdb");
		var cursor = dbo.collection("blogs").find();
		arr = cursor.toArray();
		console.log("Array: " + arr);
	response.render('viewblogs', arr);
	});
});

const getBlogById = async (id, callback) => {
	try {
		MongoClient.connect(mongoURL, (err, db) => {
			if (err) throw err;
			var dbo = db.db("teapotdb");
			dbo.collection("blogs").findOne({_id: ObjectId(id) }, (err, res) => {
				if (err) throw err;
				db.close();
				console.log("bloafj");
				return callback(null, res);
			});
		});
	} catch (err) {
		return callback(err, null);
	}
}

app.get('/viewsingle/:blogid/', (request, response) => {
	const blogid = request.params.blogid;
	response.set('Cache-control', 'public, max-age=300, s-maxage=600');
	console.log("blorg");
	MongoClient.connect(mongoURL, (err, db) => {
		if (err) throw err;
		var id = request.body;
		getBlogById(blogid, async (err, result) => {
			if (err) throw err;
			console.log("blah");
			response.render('viewsingle', {blog: result});
		});
	});
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
