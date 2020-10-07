
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
const ObjectId = require('mongodb').ObjectID;

// To interact with local database, if you have mongodb installed:
const mongoURL = "mongodb://localhost:27017/teapotdb";

// Remote database, in MongoDB atlas: (Replace with real password)
// const mongoURL = "mongodb+srv://admin:<password>@cluster0.iui7x.mongodb.net/teapotdb?retryWrites=true&w=majority";

// Authentication

const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const getUserByUsername = async (username, callback) => {
    try {
        MongoClient.connect(mongoURL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("teapotdb");
            dbo.collection("users").findOne({ username: username }, (err, res) => {
                if(err) throw err;
                db.close();
                return callback(null, res);
            });
        });
    }catch(err) {
        return callback(err, null);
    }
};
const getUserById = async (id, callback) => {
    try {
        MongoClient.connect(mongoURL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("teapotdb");
            dbo.collection("users").findOne({ _id: ObjectId(id) }, (err, res) => {
                if(err) throw err;
                db.close();
                return callback(null, res);
            });
        });
    }catch(err) {
        return callback(err, null);
    }
}

const authUser = async (username, password, done) => {
    getUserByUsername(username, async (err, user) => {
        if(err) return done(err);
        if(user == null) {
            return done(null, false, { message: 'Invalid username' });
        }
        try {
            if(await bcrypt.compare(password, user.password)) {
                return done(null, user);
            }else {
                return done(null, false, { message: 'Invalid passowrd' });
            }
        }catch(e) {
            return done(e);
        }
    });
};
passport.use(new LocalStrategy({ usernameField: 'username' }, authUser));
passport.serializeUser((user, done) => {
    done(null, user._id);
});
passport.deserializeUser((id, done) => {
    getUserById(id, async (err, user) => {
        if(err) return done(err, null);
        return done(null, user);
    });
});

const flash = require('express-flash');
const session = require('express-session');
const cookieParser = require('cookie-parser');

app.use(cookieParser('secret'));
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({ secret: 'secret' }));
app.use(passport.initialize());
app.use(passport.session());

// Routes

app.get('/writeblog/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('writeblog', {layout: 'index'});
});

app.get('/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    if(request.user == null) {
        response.render('home');
    }else {
        response.render('home', { name: request.user.username });
    }
});

app.get('/register/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('register');
});

app.get('/login/', (request, response) => {
    response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('login');
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

app.post('/postregister', async (request, response) => {
    var userObject = request.body;
    // TODO: validate user object
    try {
        userObject.password = await bcrypt.hash(userObject.password, 10);
        MongoClient.connect(mongoURL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("teapotdb");
            dbo.collection("users").insertOne(userObject, (err, res) => {
                if(err) throw err;
                console.log("1 user inserted to database");
                db.close();
            });
        });
        response.redirect('/login/');
    }catch {
        console.log('error registering, redirecting to register page');
        response.redirect('/register/');
    }
});

app.post('/postlogin', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login/',
    failureFlash: true
}));

exports.app = functions.https.onRequest(app);
