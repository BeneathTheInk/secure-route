export default function(fn) {
	return function(...args) {
		let cb;
		if (typeof args[args.length - 1] === "function") {
			cb = args.pop();
		}

		return fn.apply(this, args).then(r => {
			if (cb) cb.call(this, null, r);
			return r;
		}, e => {
			if (cb) cb.call(this, e);
			else throw e;
		});
	};
}
