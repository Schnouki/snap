/*! https://mths.be/includes v1.0.0 by @mathias */
if (!String.prototype.includes) {
	const toString = {}.toString;
	const indexOf = ''.indexOf;
	const includes = function includes(search) {
		if (this == null) {
			throw TypeError();
		}
		const string = String(this);
		if (search && toString.call(search) == '[object RegExp]') {
			throw TypeError();
		}
		const stringLength = string.length;
		const searchString = String(search);
		const searchLength = searchString.length;
		const position = arguments.length > 1 ? arguments[1] : undefined;
		// `ToInteger`
		let pos = position ? Number(position) : 0;
		if (pos != pos) { // better `isNaN`
			pos = 0;
		}
		const start = Math.min(Math.max(pos, 0), stringLength);
		// Avoid the `indexOf` call if no match is possible
		if (searchLength + start > stringLength) {
			return false;
		}
		return indexOf.call(string, searchString, pos) != -1;
	};

	Object.defineProperty(String.prototype, 'includes', {
		value: includes,
		configurable: true,
		writable: true
	});
}
