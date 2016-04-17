import confusedAsync from "./confused-async";
import callbackify from "./callbackify";

export default function(options={}) {
	return async function(req, res, next) {
		// self-awareness
		if (req.authorize) return next();

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
			req.unauthorized = unauthorized;

			// initiate the request and complete initial authorization
			if (typeof options.init === "function") {
				await confusedAsync(options.init, req);
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

	// tests that the user is signed in
	function loggedIn() {
		if (typeof options.loggedIn !== "function") {
			return false;
		}

		return options.loggedIn.call(this);
	}

	// considers the request unauthorized
	function unauthorized() {
		if (typeof options.unauthorized === "function") {
			options.unauthorized.call(this, this.res);
		} else {
			this.res.sendStatus(401);
		}
	}

	// prevents continuing through middlware when not signed in
	function lockdown(next) {
		let req = this;

		// resolve the callback
		if (next == null) next = req.next;

		// if the user is logged in, move on
		if (req.loggedIn()) return next();

		// otherwise this is a normal 401
		req.unauthorized();
	}
}
