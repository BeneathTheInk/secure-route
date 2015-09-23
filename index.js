var _ = require("underscore");
var basicAuth = require("basic-auth");
var Promise = require("bluebird");

module.exports = function(options) {
	options = options || {};

	return function(req, res, next) {
		// add helpers to the request
		req.signin = signin;
		req.signout = signout;
		req.lockdown = lockdown;
		req.setSignedInUser = setSignedInUser;

		// helpers for this method
		function done(err) {
			if (err) return next(err);
			if (options.lock) req.lockdown(next);
			else next();
		}

		function handleUser(err, user) {
			req.user = user != null ? user : null;
			done(err);
		}

		// basic auth check
		if (options.basic !== false) {
			var basic = basicAuth(req);
			if (basic != null) return runSignin(basic.name, basic.pass).nodeify(handleUser);
		}

		// user's custom lookup
		if (typeof options.retrieve === "function") {
			return options.retrieve(req, res, handleUser);
		}

		// or nothing
		done();
	};

	function runSignin(user, pass) {
		return Promise.try(function() {
			if (typeof options.signin === "function") {
				return Promise.promisify(options.signin)(user, pass);
			}
		});
	}

	// authenticates a user and applies result to the request
	function signin(user, pass, cb) {
		var req = this;

		return runSignin(user, pass).tap(function(data) {
			if (data != null) return req.setSignedInUser(data);
		}).nodeify(cb);
	}

	// removes user information from the request
	function signout(cb) {
		var req = this,
			res = req.res,
			user = req.user;

		return Promise.try(function() {
			if (typeof options.clear === "function") {
				return Promise.promisify(options.clear)(req, res);
			}
		}).then(function() {
			req.user = null;
			return user;
		}).nodeify(cb);
	}

	// prevents continuing through middlware when not signed in
	function lockdown(opts, next) {
		var req = this,
			res = req.res;

		if (typeof opts === "function" && next == null) {
			next = opts;
			opts = null;
		}

		if (next == null) next = req.next;

		// if the user is logged in, move on
		if (req.user != null) return next();

		opts = _.extend({}, options, opts || {});

		// otherwise this is a normal 401
		if (typeof opts.unauthorized === "function") {
			opts.unauthorized(req, res, next);
		} else {
			res.sendStatus(401);
		}
	}

	// applies user data to the request
	function setSignedInUser(userdata, cb) {
		var req = this,
			res = req.res;

		// always set req.user to the userdata
		req.user = userdata;

		return Promise.try(function() {
			if (typeof options.save === "function") {
				return Promise.promisify(options.save)(req, res);
			} else {
				return Promise.resolve();
			}
		}).nodeify(cb);
	}

};
