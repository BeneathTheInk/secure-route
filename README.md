# Secure Route

[![npm](https://img.shields.io/npm/v/secure-route.svg)](https://www.npmjs.com/package/secure-route) [![David](https://img.shields.io/david/BeneathTheInk/secure-route.svg)](https://david-dm.org/BeneathTheInk/secure-route) [![Build Status](https://travis-ci.org/BeneathTheInk/secure-route.svg?branch=master)](https://travis-ci.org/BeneathTheInk/secure-route)

Super simple authentication middleware for Express.

```js
const express = require("express");
const basicAuth = require("basic-auth");
const secureRoute = require("secure-route");

const app = express();

app.use(secureRoute({
	init: function() {
		const auth = basicAuth(this);
		return this.login(auth.username, auth.password);
	},
	login: function(username, password) {
		if (auth.username === "admin" && auth.password === "12345") {
			return this.authorize({ name: auth.username });
		} else {
			throw new Error("Incorrect username or password.");
		}
	},
	authorize: function(user) {
		this.user = user;
	},
	loggedIn: function() {
		return Boolean(this.user);
	},
	logout: function() {
		delete this.user;
	}
}));

app.get("/", function(req, res, next) {
	res.send(req.user);
});

// GET http://admin:12345@localhost:3000/ → { name: "admin" }
```

## Install

Grab a copy from NPM:

```sh
npm i secure-route --save
```

## Usage

```text
secureRoute([ options ]) → function
```

This package exports a function that can be called with `options`. It will return a function that can be used in an Express/Connect middleware stack.

### Options

Here are all of the available options.

> Note: Options that are functions can be run asynchronously by returning a Promise or adding an extra argument for a callback method. If the method is fully synchronous, do not add a callback method. Additionally, these functions are always called with the `request` as context (aka. `this`).

#### `init`

The `init` option is an *optional* function that is called at the beginning of every request. It is not given any special arguments.

This method serves as a gatekeeper for the remaining middleware in the stack. It should parse the request for authorization information and setup the request for further middleware.

For example, this method could use Express sessions to determine if the user is already signed in.

```js
secureRoute({
	init: function() {
		if (req.session && req.session.user) {
			req.user = req.session.user;
		}
	}
});
```

#### `authorize`

The `authorize` option is a function that saves user data to the request. The user data usually comes as a result of `login` method, but it can also be called directly.

This method should set up the request for the further middleware (similar to `init`), but it should also authorize future requests from the same client. This usually comes in the form of cookies or sessions

```js
secureRoute({
	authorize: function(userdata) {
		req.session.user = userdata;
	}
});
```

#### `login`

The `login` option is a function that is responsible for authorizing a standard username and password. It is called with the username and password for arguments and should return user data. The result of this method is handed directly to `authorize()` so further requests are also authenticated.

```js
secureRoute({
	login: function(name, pass, cb) {
		users.findOne({ name }, function(err, user) {
			if (err) return cb(err);
			if (!user) return cb(new Error("Incorrect username."));
			if (hashPassword(pass) !== user.password) {
				return cb(new Error("Incorrect password."));
			}

			cb(null, user);
		});
	}
});
```

#### `logout`

The `logout` option is a function that clears the request of existing authorization. Usually this means reversing any request state that was added by `authorize`.

```js
secureRoute({
	logout: function() {
		delete req.session.user;
	}
});
```

#### `loggedIn`

The `loggedIn` option is a function that should test the request to see if the user is considered signed in. Generally this tests for request state that was added with `authorize`.

```js
secureRoute({
	loggedIn: function() {
		return Boolean(req.session && req.session.user);
	}
});
```

#### `unauthorized`

The `unauthorized` option is an *optional* function that is called whenever the route is locked, either via the `lock` option or when `req.lockdown()` is called. It is passed a single argument, the response object.

If this method is not provided, a `res.sendStatus(401)` is used for unauthorized requests.

```js
secureRoute({
	unauthorized: function(res) {
		res.status(401).type("text").send("Not allowed here.");
	}
});
```

#### `lock`

The `lock` option is a boolean that determines if the route should prevent requests which are not authorized. This is set to 'false' by default, which means that all requests, including unauthenticated requests, are allowed through.

### Request Methods

This middleware attaches several methods to the `request` object. These methods will be available to middleware declared below this one.

#### req.login()

```text
req.login(username, password [, callback ]) → Promise
```

Attempts to log in a user with `username` and `password`. The `callback` is called when sign in completes, possibly with an error.

This will call both `options.login()` and `options.authorize()`, so that further calls to the server are authenticated.

```js
app.post("/login", function(req, res, next) {
	req.login(req.body.username, req.body.password, function(err) {
		if (err) return next(err);
		res.render("signin-success", { user: req.user });
	});
});
```

#### req.authorize()

```text
req.authorize(user [, callback ]) → Promise
```

Similar to `req.login()` but skips the sign in step. This will directly apply user data to the request, and call `options.authorize()` so further request are authenticated. This is useful when signing in a user without a standard username and password.

```js
app.get("/auth", function(req, res, next) {
	signinWithToken(req.query.token, function(err, user) {
		if (err) return next(err);
		req.authorize(user, next);
	});
})
```

#### req.logout()

```text
req.logout([ callback ]) → Promise
```

Logs out the currently logged in user. This calls `options.logout()` under the hood. The `callback` is called when sign out completes, possibly with an error.

```js
app.get("/logout", function(req, res, next) {
	req.logout(function(err) {
		if (err) return next(err);
		res.redirect("/login");
	});
});
```

#### req.loggedIn()

```text
req.loggedIn() → Boolean
```

Returns a boolean for whether or not the request has been authorized. This calls `options.loggedIn()` under the hood.

#### req.lockdown()

```text
req.lockdown([ next ]) → undefined
```

Prevents unauthorized users from proceeding through the middleware stack. This calls `options.unauthorized()` when a user is not logged in.

The `next` function is optional and is called if the user is allowed to pass through. If you don't provide a next function, the current `next` for the middleware is used, which means that `req.lockdown()` must be the last item called in a route.

```js
app.get("/account", function(req, res, next) {
	req.lockdown();
});
```

#### req.unauthorized()

```text
req.unauthorized() → undefined
```

A request method to directly call `options.unauthorized()` and send the user an unauthorized response.
