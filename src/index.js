import confusedAsync from "./confused-async";
import callbackify from "./callbackify";

export default function(options={}) {
	return async function(req, res, next) {
		// self-awareness
		if (req.authorize) return;

		// lock or finish method
		function done(err) {
			if (err) return next(err);
			if (options.lock) req.lockdown(next);
			else next();
		}

		try {
			// add helpers to the request
			req.authorize = callbackify(authorize);
			req.login = callbackify(login);
			req.logout = callbackify(logout);
			req.lockdown = lockdown;
			req.loggedIn = loggedIn;

			// initiate the request and complete initial authorization
			if (typeof options.init === "function") {
				await confusedAsync(options.init, this);
			}

			// and complete
			done();
		} catch(e) {
			done(e);
		}
	};

	async function callOptionMethod(ctx, name, args=[]) {
		if (typeof options[name] !== "function") {
			throw new Error(`Missing ${name} function in secure-route options.`);
		}

		return await confusedAsync(options[name], ctx, args);
	}

	// applies user data to the request
	async function authorize(data) {
		return await callOptionMethod(this, "authorize", [ data ]);
	}

	// authenticates a user and applies result to the request
	async function login(user, pass) {
		let data = await callOptionMethod(this, "login", [ user, pass ]);
		if (data != null) await this.authorize(data);
		return data;
	}

	// removes user information from the request
	async function logout() {
		return await callOptionMethod(this, "logout");
	}

	function loggedIn() {
		if (typeof options.loggedIn !== "function") {
			return false;
		}

		return options.loggedIn.call(this);
	}

	// prevents continuing through middlware when not signed in
	function lockdown(opts, next) {
		let req = this;
		let res = req.res;

		// resolve the callback
		if (typeof opts === "function" && next == null) {
			[next,opts] = [opts,null];
		} else if (next == null) {
			next = req.next;
		}

		// if the user is logged in, move on
		if (req.loggedIn()) return next();

		// otherwise this is a normal 401
		let unauthorized = (opts && opts.unauthorized) || options.unauthorized;
		if (typeof unauthorized === "function") {
			unauthorized(req, res, next);
		} else {
			res.sendStatus(401);
		}
	}
}
