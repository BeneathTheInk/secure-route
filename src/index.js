import {assign} from "lodash";
import basicAuth from "basic-auth";
import confusedAsync from "./confused-async";
import callbackify from "./callbackify";

export default function(options={}) {
	return async function(req, res, next) {
		// self-awareness
		if (req.signin) return;

		// add helpers to the request
		req.signin = callbackify(signin);
		req.signout = callbackify(signout);
		req.lockdown = lockdown;
		req.setSignedInUser = callbackify(setSignedInUser);

		// helpers for this method
		function done(err) {
			if (err) return next(err);
			if (options.lock) req.lockdown(next);
			else next();
		}

		function handleUser(user) {
			req.user = user != null ? user : null;
		}

		try {
			// basic auth check
			if (options.basic !== false) {
				let basic = basicAuth(req);
				if (basic != null) {
					handleUser(await runSignin(basic.name, basic.pass));
				}
			}

			// user's custom lookup
			if (!req.user && typeof options.retrieve === "function") {
				handleUser(await confusedAsync(options.retrieve, this, [ req, res ]));
			}

			// and complete
			done();
		} catch(e) {
			done(e);
		}
	};

	async function runSignin(user, pass) {
		if (typeof options.signin === "function") {
			return await confusedAsync(options.signin, this, [user, pass]);
		}
	}

	// authenticates a user and applies result to the request
	async function signin(user, pass) {
		let data = await runSignin.call(this, user, pass);
		if (data != null) await this.setSignedInUser(data);
		return data;
	}

	// removes user information from the request
	async function signout() {
		let req = this;
		let res = req.res;
		let user = req.user;

		if (typeof options.clear === "function") {
			await confusedAsync(options.clear, this, [ req, res ]);
		}

		req.user = null;
		return user;
	}

	// prevents continuing through middlware when not signed in
	function lockdown(opts, next) {
		let req = this;
		let res = req.res;

		if (typeof opts === "function" && next == null) {
			next = opts;
			opts = null;
		}

		if (next == null) next = req.next;

		// if the user is logged in, move on
		if (req.user != null) return next();

		opts = assign({}, options, opts || {});

		// otherwise this is a normal 401
		if (typeof opts.unauthorized === "function") {
			opts.unauthorized(req, res, next);
		} else {
			res.sendStatus(401);
		}
	}

	// applies user data to the request
	async function setSignedInUser(userdata) {
		let req = this;
		let res = req.res;

		// always set req.user to the userdata
		req.user = userdata;

		if (typeof options.save === "function") {
			await confusedAsync(options.save, this, [ req, res ]);
		}
	}
}
