
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

const addToHistory = async (username, type, blogid, callback) => {
	//username and type are strings
	getUserByUsername(username, async (err, user) => {
		if (err) return callback(err);
		try {
			MongoClient.connect(mongoURL, (err, db) => {
				if (err) throw err;
				var dbo = db.db("teapotdb");
				if (user.history == null) {
					dbo.collection("users").updateOne({username: username}, {$set: {history: [{blogid: blogid, type: type}]}}, (err, res) => {
						if (err) throw err;
						return callback (null);
					});
				} else {
					dbo.collection("users").updateOne({username: username}, {$push: {history: {blogid: blogid, type: type}}}, (err, res) => {
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
const bodyParser = require('body-parser');
app.use(bodyParser());
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

app.get('/viewsingle/:blogid/writecomment/', (request, response) => {
    if(request.user) {
        getBlogById(request.params.blogid, async (err, blog) => {
            if (err || blog == null) {
                request.flash('error', 'could not find blog');
                return response.redirect('/');
             }
            response.render('writecomment', {blog : blog});
        });
    } else {
        request.flash('error', 'must be logged in to comment');
        response.redirect('/login/');
    }
});

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
const getBlogByTopic = async (topicname, callback) => {
	try {
		MongoClient.connect(mongoURL, (err, db) => {
			if (err) throw err;
			var dbo = db.db("teapotdb");
			dbo.collection("blogs").findOne({topic: topicname }, (err, res) => {
				if (err) throw err;
				db.close();
				return callback(null, res);
			});
		});
	} catch (err) {
		return callback(err, null);
	}
}

const getComments = async (id, callback) => {
        try {
            MongoClient.connect(mongoURL, (err, db) => {
                if(err) throw err;
                var dbo = db.db("teapotdb");
                dbo.collection("comments").find({"blogid": id}).toArray(function(err, res) {
                    if (res.length > 0) {
                        console.log("more than 1");
                    }
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

            addToHistory(request.user.username, "viewed", blogid, (err) => {
                if (err) throw err;
                
                getComments(blogid, async (err, res) => {
                    if (err || res == null) {
                        request.flash('error', 'could not find blog');
                        return response.redirect('/');
                    }
                    response.render('viewsingle', {blog: result, editbutton: true, comments : res, savebutton: true});
                });
            });
        }
        else if(request.user != null && request.user.username != null && request.user.username != result.author) {
            addToHistory(request.user.username, "viewed", blogid, (err) => {
                if (err) throw err;
                getComments(blogid, async (err, res) => {
                    if (err || res == null) {
                        request.flash('error', 'could not find blog');
                        return response.redirect('/');
                    }
                    response.render('viewsingle', {blog: result, upvote: true, downvote: true, comments : res, savebutton: true});
                });
            });
        }
        else {
            getComments(blogid, async (err, res) => {
                if (err || res == null) {
                    request.flash('error', 'could not find blog');
                    return response.redirect('/');
                }
                response.render('viewsingle', {blog: result, comments : res});
            });
        }
    });
});

app.get('/topic/:topic/', (request, response) => {
    const topic = request.params.topic;
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        var query = { topic: topic };
        dbo.collection('blogs').find(query).toArray((err, result) => {
            if(err) throw err;
            db.close();
            var params = { arr: result, topic: topic };
            if(request.user != null && request.user.following_topics != null && request.user.following_topics.includes(topic)) {
                params.unfollowbutton = true;
            }else if(request.user != null) {
                params.followbutton = true;
            }
            response.render('topic', params);
        });
    });
});

// app.get('/topic/:topicname/', (request, response) => {
//     const topicname = request.params.topicname;
//     getBlogByTopic(topicname, async (err, result) => {
//         if(err || result == null) {
//             request.flash('error', 'could not find blog');
//             return response.redirect('/');
//         }else {
//             response.redirect('/viewsingle/' + result._id.toString());
//         }
//     });
// });

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
        var params = { username: user.username };
        if(request.user != null && request.user.username == user.username) {
            // only display private information if that user is the one viewing
            params.email = user.email;
        }
        if(request.user != null && request.user.following_users != null && request.user.following_users.includes(username)) {
            params.unfollowbutton = true;
        }else if(request.user != null && request.user.username != username) {
            params.followbutton = true;
        }
        response.render('profile', params);
    });
});

app.get('/user/:username/edit', (request, response) => {
    const username = request.params.username;
    getUserByUsername(username, (err, user) => {
        if(err || user == null) {
            request.flash('error', 'User not found');
            return response.redirect('/');
        }
    response.render('editprofile', {user: user });
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

app.get('/deleteuser/:username', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'User must be logged in');
        return response.redirect('/login/');
    }
    try {
        const username = request.params.username;
        getUserByUsername(username, (err, user) => {
            if(err || user == null) {
                request.flash('error', 'User not found');
                return response.redirect('/');
            }
            if(request.user.username != username) {
                request.flash('error', 'You don\'t have permission to delete this account');
                return response.redirect('/');
            }
            MongoClient.connect(mongoURL, (err, db) => {
                if(err) throw err;
                var dbo = db.db("teapotdb");
                var myQuery = { username: username };
                
                dbo.collection('users').deleteOne(myQuery, (err, db) => {
                    if(err) throw err;
                    console.log("User deleted ");
                    db.close();                  
                });
            });
            response.redirect('/');
        });
    }catch {
        // throw e;
        request.flash('error', 'Error delete user');
        response.redirect('/');
    }
});


app.get('/deleteblog/:blogid', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in');
        return response.redirect('/login/');
    }
    try {
        var blogid = request.params.blogid;
        getBlogById(blogid, async (err, blog) => {
            if(err || blog == null) {
                request.flash('error', 'Blog not found');
                return response.redirect('/');
            }
            if(blog.author != request.user.username) {
                request.flash('error', 'You don\'t have permission to edit this blog');
                return response.redirect('/');
            }
            MongoClient.connect(mongoURL, (err, db) => {
                if(err) throw err;
                var dbo = db.db("teapotdb");
                var myQuery = { _id: ObjectId(blogid) };
                
                dbo.collection('blogs').deleteOne(myQuery, (err, db) => {
                    if(err) throw err;
                    console.log("1 blog deleted ");
                    db.close();                  
                });
            });
            response.redirect('/');
        });
    }catch {
        // throw e;
        request.flash('error', 'Error delete blog');
        response.redirect('/');
    }
});

app.get('/notifications/', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in to see notifications');
        return response.redirect('/login/');
    }
    notif_list = request.user.notifications;
    read_list = request.user.read_notifications;
    if(notif_list == null) {
        notif_list = [];
    }
    if(read_list == null) {
        read_list = [];
    }
    // move all notifications to read
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        var query = { username: request.user.username };
        var update = {
            $pullAll: { notifications: notif_list },
            $push: { read_notifications: { $each: notif_list } }
        };
        dbo.collection('users').updateOne(query, update, (err, res) => {
            if(err) throw err;
            console.log("marked notifications as read");
            db.close();
            response.render('notifications', { notif_list: notif_list, read_list: read_list });
        });
    });
});

app.get('/followtopic/:topic', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in to follow topics');
        return response.redirect('/login/');
    }
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        var query = { username: request.user.username };
        var newvals = { $addToSet: { following_topics: request.params.topic }};
        dbo.collection('users').updateOne(query, newvals, (err, res) => {
            if(err) throw err;
            console.log("added to following list");
            db.close();
            response.redirect('/topic/' + request.params.topic);
        });
    });
});

app.get('/unfollowtopic/:topic', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in to unfollow topics');
        return response.redirect('/login/');
    }
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        var query = { username: request.user.username };
        var newvals = { $pull: { following_topics: request.params.topic }};
        dbo.collection('users').updateOne(query, newvals, (err, res) => {
            if(err) throw err;
            console.log("removed from following list");
            db.close();
            response.redirect('/topic/' + request.params.topic);
        });
    });
});

app.get('/follow/:username', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in to follow users');
        return response.redirect('/login/');
    }
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        var query = { username: request.user.username };
        var newvals = { $addToSet: { following_users: request.params.username }};
        dbo.collection('users').updateOne(query, newvals, (err, res) => {
            if(err) throw err;
            console.log("added to following list");
            var query2 = { username: request.params.username };
            var newvals2 = { $addToSet: { followers: request.user.username }};
            dbo.collection('users').updateOne(query2, newvals2, (err, res) => {
                if(err) throw err;
                console.log("added to followers list");
                db.close();
                response.redirect('/user/' + request.params.username);
            });
        });
    });
});

app.get('/unfollow/:username', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in to unfollow users');
        return response.redirect('/login/');
    }
    MongoClient.connect(mongoURL, (err, db) => {
        if(err) throw err;
        var dbo = db.db("teapotdb");
        var query = { username: request.user.username };
        var newvals = { $pull: { following_users: request.params.username }};
        dbo.collection('users').updateOne(query, newvals, (err, res) => {
            if(err) throw err;
            console.log("removed from following list");
            var query2 = { username: request.params.username };
            var newvals2 = { $pull: { followers: request.user.username }};
            dbo.collection('users').updateOne(query2, newvals2, (err, res) => {
                if(err) throw err;
                console.log("removed from followers list");
                db.close();
                response.redirect('/user/' + request.params.username);
            });
        });
    });
});

app.get('/logout/', (request, response) => {
    request.logout();
    response.redirect('/');
});

app.post('/postcomment/:blogid/', (request, response) => {
    if(request.user == null) {
        request.flash('error', 'must be logged in to comment');
        return response.redirect('/login/');
    }
    var commentObject = request.body;
    commentObject.anon = request.body.anon;
    if (commentObject.anon = 'on') {
       commentObject.author = "anonymous";
    }
    else {
        commentObject.author = request.user.username;
    }
    commentObject.voteCount = 0;
    commentObject.blogid = request.params.blogid;
    console.log(commentObject);
    try {
        MongoClient.connect(mongoURL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("teapotdb");
            dbo.collection("comments").insertOne(commentObject, (err, res) => {
                if(err) throw err;
                console.log("1 comment inserted to database");
                db.close();
                return response.redirect('/viewsingle/' + commentObject.blogid);
            });
        });
    }catch {
        request.flash('error', 'Error posting comment');
        response.redirect('/viewsingle/' + blogid);
    }
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
                console.log("blog:");
                console.log(res.ops[0]._id.toString());

                // add notification to everyone following request.user
                var query = {
                    $or: [
                        { following_users: { $in: [ request.user.username ] }},
                        { following_topics: { $in: [ blogObject.topic ] }}
                    ]
                };
                var update = { $push: { notifications: {
                    blogid: res.ops[0]._id,
                    title: blogObject.title,
                    author: blogObject.author
                }}};
                dbo.collection("users").updateMany(query, update, (err, res2) => {
                    if(err) throw err;
                  
                    addToHistory(request.user.username, "posted", res.ops[0]._id, (err) => {
                        db.close();
                        return response.redirect('/viewsingle/' + res.ops[0]._id.toString());
                    });
                });
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
			addToHistory(request.user.username, "edited", blogid, (err) => {
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

app.post('/postprofile/', async(request, response) => {
    try {
        var userObject = request.body;
        console.log(request.body);
        userObject.password = await bcrypt.hash(userObject.password, 10);
        MongoClient.connect(mongoURL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("teapotdb");
            var query = { _id: ObjectId(userObject._id) };
            var newvals = { $set : { school: userObject.school, firstName: userObject.firstName, 
                            lastName: userObject.lastName, emailShow: userObject.emailShow, 
                            schoolShow: userObject.schoolShow, firstNameShow: userObject.firstNameShow,
                            lastNameShow: userObject.lastNameShow }};
            dbo.collection('users').updateOne(query, newvals, (err, res) => {
                if(err) throw err;
                console.log("1 user profile updated.");
                request.flash('info', 'Profile updated.');
                db.close();
                response.redirect('/user/' + userObject.username);
            });
        });
    }catch {
        console.log('error editing profile, redirecting to login.');
        response.redirect('/login/');
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
    userObject.firstName = "";
    userObject.lastName = "";
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
