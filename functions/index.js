
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
                return done(null, false, { message: 'Invalid password' });
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

const addToHistory = async (username, type, blog, callback) => {
	//username and type are strings
	getUserByUsername(username, async (err, user) => {
		if (err) return callback(err);
		try {
			MongoClient.connect(mongoURL, (err, db) => {
				if (err) throw err;
				var dbo = db.db("teapotdb");
				if (user.history == null) {
					dbo.collection("users").updateOne({username: username}, {$set: {history: [{blog: blog, type: type}]}}, (err, res) => {
						if (err) throw err;
						return callback (null);
					});
				} else {
					dbo.collection("users").updateOne({username: username}, {$push: {history: {blog: blog, type: type}}}, (err, res) => {
						if (err) throw err;
						return callback (null);
					});
				}
			});
		} catch {
			return callback(err);
		}
	});
}

const flash = require('express-flash');
const session = require('express-session');
const cookieParser = require('cookie-parser');

app.use(cookieParser('secret'));
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({ secret: 'secret' }));
app.use(passport.initialize());
app.use(passport.session());

app.use((request, response, next) => {
    response.locals.req = request;
    next();
});

// Routes

app.get('/writeblog/', (request, response) => {
    // response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    if(request.user) {
        response.render('writeblog');
    }else {
        request.flash('error', 'must be logged in');
        response.redirect('/login/');
    }
});

app.get('/viewblogs/', (request, response) => {
	var arr;
	MongoClient.connect(mongoURL, (err, db) => {
		if(err) throw err;
		var dbo = db.db("teapotdb");
        var cursor = dbo.collection("blogs").find();
        arr = cursor.toArray();
		response.render('viewblogs', {arr: arr});
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
				return callback(null, res);
			});
		});
	} catch (err) {
		return callback(err, null);
	}
}

app.get('/viewsingle/:blogid/', (request, response) => {
	const blogid = request.params.blogid;
    getBlogById(blogid, async (err, result) => {
        if (err || result == null) {
            request.flash('error', 'could not find blog');
            return response.redirect('/');
        }
        if(request.user != null && request.user.username == result.author) {
            	addToHistory(request.user.username, "viewed", result, (err) => {
			if (err) throw err;
			response.render('viewsingle', {blog: result, editbutton: true, savebutton: true});
		});
        }
        else if(request.user != null && request.user.username != null && request.user.username != result.author) {
        	addToHistory(request.user.username, "viewed", result, (err) => {
			if (err) throw err;
			response.render('viewsingle', {blog: result, upvote: true, downvote: true, savebutton: true});
		});
        }
        else {
            response.render('viewsingle', {blog: result});
        }
    });
});

app.get('/timeline/:sorttype/', (request, response) => {
	const sort = request.params.sorttype;
	MongoClient.connect(mongoURL, (err, db) => {
		if (err) throw err;
		var dbo = db.db("teapotdb");
		dbo.collection("blogs").find().toArray((err, result) => {
			/*result.forEach((item, index) => {
				console.log(item);
			});*/
			if (sort == "time") {
				result.reverse();
			} else if (sort == "votes") {
				result.sort(function(first, second) {
					var firstVotes = first.voteCount;
					var secondVotes = second.voteCount;
					if (firstVotes == null) {
						firstVotes = 0;
					}
					if (secondVotes == null) {
						secondVotes = 0;
					}
					if (firstVotes < secondVotes) {
						return 1;
					} else if (firstVotes > secondVotes) {
						return -1;
					} else {
						return 0;
					}
				});
			}
			if (request.user != null) {
				response.render('viewblogs', {arr: result, vote: true});
			} else {
				response.render('viewblogs', {arr: result, vote: false});
			}
		});
	});
});

app.get('/history/', (request, response) => {
	MongoClient.connect(mongoURL, (err, db) => {
		if (err) throw err;
		var dbo = db.db("teapotdb");
		if (request.user == null) {
			request.flash('error', 'You must be logged in to view your history');
			response.redirect('/');
		} else {
			response.render('history', {history: request.user.history});
		}
	});
});

app.get('/', (request, response) => {
    // response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    response.render('home');
});

app.get('/register/', (request, response) => {
    // response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    request.logout();
    response.render('register');
});

app.get('/login/', (request, response) => {
    // response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    request.logout();
    response.render('login');
});

app.get('/user/:username', (request, response) => {
    // response.set('Cache-control', 'public, max-age=300, s-maxage=600');
    const username = request.params.username;
    getUserByUsername(username, (err, user) => {
        if(err || user == null) {
            request.flash('error', 'User not found');
            return response.redirect('/');
        }
        if(request.user != null && request.user.username == user.username) {
            // only display private information if that user is the one viewing
            response.render('profile', { username: user.username, email: user.email });
        }else {
            response.render('profile', { username: user.username });
        }
    });
});

app.get('/edit/:blogid', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in');
        return response.redirect('/login/');
    }
    getBlogById(request.params.blogid, async (err, blog) => {
        if (err || blog == null) {
            request.flash('error', 'could not find blog');
            return response.redirect('/');
        }
        if(blog.author != request.user.username) {
            request.flash('error', 'you don\'t have permission to edit');
            return response.redirect('/');
        }
        response.render('editblog', { blog: blog });
    });
});

app.get('/logout/', (request, response) => {
    request.logout();
    response.redirect('/');
});

app.post('/postblog/', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in');
        return response.redirect('/login/');
    }
    var blogObject = request.body;
    blogObject.author = request.user.username;
    blogObject.voteCount = 0;
    console.log(blogObject);
    try {
        MongoClient.connect(mongoURL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("teapotdb");
            dbo.collection("blogs").insertOne(blogObject, (err, res) => {
                if(err) throw err;
                console.log("1 blog inserted to database");
                db.close();
                console.log("blog:");
                console.log(res.ops[0]._id.toString());
                addToHistory(request.user.username, "posted", res.ops[0], (err) => {
			return response.redirect('/viewsingle/' + res.ops[0]._id.toString());
		});
			//return response.redirect('/viewsingle/' + res.ops[0]._id.toString());

            });
        });
    }catch {
        request.flash('error', 'Error posting blog');
        response.redirect('/');
    }
});

app.post('/postblogedit/:blogid', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in');
        return response.redirect('/login/');
    }
    try {
        var blogid = request.params.blogid;
        getBlogById(blogid, async (err, blog) => {
            if(err || blog == null) {
                request.flash('error', 'could not find blog');
                return response.redirect('/');
            }
            if(blog.author != request.user.username) {
                request.flash('error', 'you don\'t have permission to edit');
                return response.redirect('/');
            }
            MongoClient.connect(mongoURL, (err, db) => {
                if(err) throw err;
                var dbo = db.db("teapotdb");
                var query = { _id: ObjectId(blogid) };
                var newvals = { $set: { title: request.body.title, body: request.body.body }};
                dbo.collection('blogs').updateOne(query, newvals, (err, res) => {
			if(err) throw err;
                    	console.log("1 blog updated");
                  	db.close();
			request.flash('info', 'Blog updated');
			addToHistory(request.user.username, "edited", blog, (err) => {
                    		if (err) throw err;
				response.redirect('/viewsingle/' + blogid)
			});
                });
            });
        });
    }catch {
        // throw e;
        request.flash('error', 'Error posting blog');
        response.redirect('/');
    }
});

app.get('/viewsingle/:blogid/voteup', (request, response) => {
    try {
        var blogid = request.params.blogid;
        getBlogById(blogid, async (err, blog) => {
            if (err || blog == null) {
                request.flash('error', 'could not find blog');
                return response.redirect('/');
            }
            MongoClient.connect(mongoURL, (err, db) => {
                if(err) throw err;
                var dbo = db.db("teapotdb");
                var query = { _id: ObjectId(blogid) };
                var newVals = { $inc: {voteCount: 1}};
                dbo.collection('blogs').updateOne(query, newVals, (err, res) => {
                    if(err) throw err;
                    console.log("Blog has been upvoted");
                    db.close();
                    request.flash('info', 'Vote Count Updated');
                    response.redirect('/viewsingle/' + blogid)
                });
            });
        });
    }catch {
        request.flash('error', 'Error voting on blog');
        response.redirect('/');
    }
});

app.get('/viewsingle/:blogid/votedown', (request, response) => {
    try {
        var blogid = request.params.blogid;
        getBlogById(blogid, async (err, blog) => {
            if (err || blog == null) {
                request.flash('error', 'could not find blog');
                return response.redirect('/');
            }
            MongoClient.connect(mongoURL, (err, db) => {
                if(err) throw err;
                var dbo = db.db("teapotdb");
                var query = { _id: ObjectId(blogid) };
                var newVals = { $inc: {voteCount: -1}};
                dbo.collection('blogs').updateOne(query, newVals, (err, res) => {
                    if(err) throw err;
                    console.log("Blog has been downvoted");
                    db.close();
                    request.flash('info', 'Vote Count Updated');
                    response.redirect('/viewsingle/' + blogid)
                });
            });
        });
    }catch {
        request.flash('error', 'Error voting on blog');
        response.redirect('/');
    }
});

app.get('/viewsingle/:blogid/save', (request, response) => {
	try {
		var blogid = request.params.blogid;
		getBlogById(blogid, async (err, blog) => {
			if (err || blog == null) {
				request.flash('error', 'could not find blog');
				return response.redirect('/');
			}
			MongoClient.connect(mongoURL, (err, db) => {
				if (err) throw err;
				var dbo = db.db("teapotdb");
				getUserByUsername(request.user.username, async(err, user) => {
					if (user.saved == null) {
						dbo.collection("users").updateOne({username: request.user.username}, {$set: {saved: [blog]}}, (err, res) => {
							if (err) throw err;
							request.flash('info', "Blog saved");
							response.redirect('/viewsingle/' + blogid);
						});
					} else {
						dbo.collection("users").updateOne({username: request.user.username}, {$push: {saved: blog}}, (err, res) => {
							if (err) throw err;
							request.flash('info', 'Blog saved');
							response.redirect('/viewsingle/' + blogid);
						});
					}
				});
			});
		});
	} catch {
		request.flash('error', "Error saving blog");
		response.redirect('/');
	}
});

app.get('/viewsingle/:blogid/unsave', (request, response) => {
	try {
		var blogid = request.params.blogid;
		getBlogById(blogid, async (err, blog) => {
			if (err || blog == null) {
				request.flash('error', 'could not find blog');
				return response.redirect('/saved/');
			}
			MongoClient.connect(mongoURL, (err, db) => {
				if (err) throw err;
				var dbo = db.db("teapotdb");
				getUserByUsername(request.user.username, async (err, user) => {
					dbo.collection("users").updateOne({username: request.user.username}, {$pull: {saved: blog}}, (err, res) => {
						if (err) throw err;
						request.flash('info', "Blog unsaved");
						response.redirect('/viewsingle/' + blogid);
					});
				});
			});
		});
	} catch {
		request.flash('error', "Error unsaving blog");
		response.redirect("/saved/");
	}
});

app.get('/saved/', (request, response) => {
	getUserByUsername(request.user.username, (err, user) => {
		if (err || user == null) {
			request.flash('error', 'Please login first');
			return response.redirect('/login/');
		} else {
			response.render('saved', {arr: user.saved});
		}
	});
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
                request.flash('info', 'Account registered, please login.');
                response.redirect('/login/');
                db.close();
            });
        });
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
