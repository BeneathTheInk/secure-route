# Secure Route

Super simple authentication middleware for Express.

```js
var app = require("express")();
var secureRoute = require("secure-route");

app.use(secureRoute({
	signin: function(user, pass, done) {
		if (user === "admin" && pass === "12345") {
			done(null, { name: user });
		} else {
			done(new Error("Invalid username or password"));
		}
	}
}));

app.get("/", function(req, res, next) {
	res.send(req.user);
});

// GET http://admin:12345@localhost:3000/ → { name: "admin" }
```

## Usage

### secureRoute([ options ])

This package exports a function that can be called with `options`. It will return a function that can be used in an Express/Connect middleware stack.

This middleware will look for basic authentication and attempt to sign in the user with those credentials.

This middleware adds several methods to the Express request object that are documented below.

The following options are available:

- __`signin()`__ - The function to call when testing a user and password for signin. It is called with the signature `(username, password, callback)`. The callback should be called when finished with an error or an object representing the signed in user.
- __`retrieve()`__ - A function that is called when looking up the currently signed in user from the request. It is called with the signature `(req, res, callback)`, where `req` and `res` are the current Express request and response streams. The callback should be called when finished with an error or an object representing the signed in user.
- __`save()`__ - A function that is called after sign in that saves the user to the request. For example, this could be used to store a token in the session that can be viewed on `options.retrieve()`. It is called with the signature `(req, res, callback)`, where `req` and `res` are the current Express request and response streams. The callback should be called when finished, optionally with an error.
- __`clear()`__ - Cleans up any state that was added with `options.save()`. This is run when the user is signed out. It is called with the signature `(req, res, callback)`, where `req` and `res` are the current Express request and response streams. The callback should be called when finished, optionally with an error.
- __`lock`__ - A boolean to determine if this middleware should block unauthenticated requests. This should be used with `options.retrieve()`. If the user has incorrect or missing credentials when connecting, they will receive a 401 Unauthorized, unless `options.unauthorized` has been set.
- __`unauthorized()`__ - A function that is called when an unauthorized user attempts a request. It is called with the signature `(req, res, next)`, where `req` and `res` are the current Express request and response streams. `next` is a function that when called allows express to proceed to the next middleware in the stack. This is useful for redirecting or displaying an error message.

### req.signin(username, password [, callback ])

Attempts to sign in a user with `username` and `password`. The `callback` is called when sign in completes, possibly with an error.

This will call `options.save()` if it has been set, so that further calls to the server are authenticated.

```js
app.post("/signin", function(req, res, next) {
	req.signin(req.body.username, req.body.password, function(err) {
		if (err) return next(err);
		res.render("signin-success", { user: req.user });
	});
})
```

### req.setSignedInUser(user [, callback ])

Similar to `req.signin()` but skips the sign in step. This will directly apply user data to the request, and call `options.save()` so further request are authenticated. This is useful when signing in a user without a standard username and password.

```js
app.get("/auth", function(req, res, next) {
	signinWithToken(req.query.token, function(err, user) {
		if (err) return next(err);
		req.setSignedInUser(user, next);
	});
})
```

### req.signout([ callback ])

Signs out the currently signed in user. This calls `options.clear()` under the hood. The `callback` is called when sign out completes, possibly with an error.

```js
app.get("/signout", function(req, res, next) {
	req.signout(function(err) {
		if (err) return next(err);
		res.redirect("/signin");
	});
})
```

### req.lockdown([ options ][, next ])

Prevents unauthorized users from proceeding through the middleware stack. The `next` function is optional and is called if the user is allowed to pass through. If you don't provide a next function, the current `next` for the middleware is used, which means that `req.lockdown()` must be the last item called in a route.

The following options are available:

- __`unauthorized()`__ - When specified, this function will override the `options.unauthorized()` specified in the main `secureRoute()` options.

```js
app.get("/account", function(req, res, next) {
	req.lockdown({
		unauthorized: function(req, res) {
			res.redirect("/signin");
		}
	});
});
```
