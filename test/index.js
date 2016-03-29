import test from "tape";
import supertest from "supertest";
import express from "express";

const secureRoute = require("./");

function createApp(opts) {
	let app = express();
	app.use(secureRoute(opts));
	return app;
}

test("calls init on every request", async (t) => {
	try {
		t.plan(1);

		let called = false;
		let app = createApp({
			init: function() {
				called = true;
			}
		});

		await supertest(app).get("/").expect(404);

		t.ok(called, "init was called");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("calls authorize when req.authorize is called", async (t) => {
	try {
		t.plan(3);

		let called = false;
		let data = {};

		let app = createApp({
			authorize: function(d) {
				called = true;
				t.equals(d, data, "passed data through");
			}
		});

		app.use(async function(req, res, next) {
			try {
				await req.authorize(data);
				t.ok(req.loggedIn(), "request is considered logged in");
				next();
			} catch(e) {
				next(e);
			}
		});

		await supertest(app).get("/").expect(404);

		t.ok(called, "authorize was called");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("calls login then authorize when req.login is called", async (t) => {
	try {
		t.plan(8);

		let called = {};
		let data = {};
		let username = "test";
		let password = "pass";

		let app = createApp({
			login: function(user, pass) {
				called.login = true;
				t.notOk(called.authorize, "has not called authorize yet");
				t.equals(user, username, "username matches");
				t.equals(pass, password, "password matches");
				return data;
			},
			authorize: function(d) {
				called.authorize = true;
				t.ok(called.login, "already called login");
				t.equals(d, data, "passed data through");
			}
		});

		app.use(async function(req, res, next) {
			try {
				await req.login(username, password);
				t.ok(req.loggedIn(), "request is considered logged in");
				next();
			} catch(e) {
				next(e);
			}
		});

		await supertest(app).get("/").expect(404);

		t.ok(called.login, "login was called");
		t.ok(called.authorize, "authorize was called");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("calls logout when req.logout is called", async (t) => {
	try {
		t.plan(2);

		let called = false;
		let app = createApp({
			logout: function() {
				called = true;
			}
		});

		app.use(async function(req, res, next) {
			try {
				await req.logout();
				t.notOk(req.loggedIn(), "request is considered not logged in");
				next();
			} catch(e) {
				next(e);
			}
		});

		await supertest(app).get("/").expect(404);

		t.ok(called, "logout was called");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("responds with 401 when lock option is enabled", async (t) => {
	try {
		t.plan(1);

		let app = createApp({
			lock: true
		});

		await supertest(app).get("/").expect(401);
		t.pass("request was unauthorized");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("calls unauthorized method when request is locked", async (t) => {
	try {
		t.plan(1);

		let called = false;
		let app = createApp({
			lock: true,
			unauthorized: function(req, res) {
				called = true;
				res.sendStatus(401);
			}
		});

		await supertest(app).get("/").expect(401);
		t.ok(called, "called unauthorized method");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("calls unauthorized method as an option of req.lockdown", async (t) => {
	try {
		t.plan(1);

		let called = false;
		let app = createApp();

		app.use(function(req) {
			req.lockdown({
				unauthorized: function(req, res) {
					called = true;
					res.sendStatus(401);
				}
			});
		});

		await supertest(app).get("/").expect(401);
		t.ok(called, "called unauthorized lockdown option");
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});

test("completes flow", async (t) => {
	try {
		t.plan(8);

		let data = {};
		let username = "test";
		let password = "pass";

		let app = createApp({
			login: function(user, pass) {
				t.pass("called login");
				t.equals(user, username, "username matches");
				t.equals(pass, password, "password matches");
				return data;
			},
			authorize: function(d) {
				t.pass("called authorize");
				t.equals(d, data, "passed data through");
			},
			logout: function() {
				t.pass("called logout");
			}
		});

		app.use(async function(req, res, next) {
			try {
				await req.login(username, password);
				t.ok(req.loggedIn(), "request is considered logged in");
				await req.logout();
				t.notOk(req.loggedIn(), "request is considered not logged in");
				next();
			} catch(e) {
				next(e);
			}
		});

		await supertest(app).get("/").expect(404);
	} catch(e) {
		t.error(e);
	} finally {
		t.end();
	}
});
