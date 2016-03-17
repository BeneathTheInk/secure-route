import {last} from "lodash";

export default function(fn) {
	return function(...args) {
		let cb;
		if (typeof last(args) === "function") {
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
