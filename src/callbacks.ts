const callbacks: Map<PageEvent, Function[]> = new Map()
	.set('fetch', [])
	.set('receive', [])
	.set('wait', [])
	.set('change', [])
	.set('restore', [])
	.set('progress', []);

export function trigger(eventType: PageEvent, arg1?, arg2?, arg3?) {
	let returnValue;
	if (eventType === 'receive') {
		for (const callback of callbacks.get(eventType)) {
			const altered = callback(arg1, arg2, arg3);
			if (altered) {
				/* Update args for the next iteration of the loop. */
				if (altered.body !== undefined) {
					arg2 = altered.body;
				}
				if (altered.title !== undefined) {
					arg3 = altered.title;
				}

				returnValue = altered;
			}
		}
	} else {
		for (const callback of callbacks.get(eventType)) {
			callback(arg1, arg2, arg3);
		}
	}
	return returnValue;
}

export function on(eventType: PageEvent, callback: Function) {
	callbacks.get(eventType).push(callback);
}

export function off(eventType: PageEvent) {
	callbacks.set(eventType, []);
}
