const $userAgent = navigator.userAgent;

// Internal variables
const $isChromeForIOS: boolean = $userAgent.includes(' CriOS/');
let $currentLocationWithoutHash: string;
let $urlToPreload: string;
let $preloadTimer: number;
let $lastTouchTimestamp: number;

// Preloading-related variables;
const $history = Object.create(null);
let $xhr: XMLHttpRequest;
let $url: string;
let $title: string;
let $mustRedirect = false;
let $body: HTMLBodyElement;
let $timing: { start?: number, ready?: number, display?: number } = {};
let $isPreloading = false;
let $isWaitingForCompletion = false;
const $trackedAssets: Array<HTMLElement|string> = [];

// Variables defined by public functions;
let $preloadOnMousedown: boolean;
let $delayBeforePreload: number;

type Callback = () => any;
type ReceiveCallback = (url: string, body: HTMLBodyElement, title: string) => (boolean|{
	body?: HTMLBodyElement,
	title?: string
});
type ChangeCallback = (isInitialLoad: boolean) => any;

const $eventsCallbacks: {
	fetch: Callback[],
	receive: ReceiveCallback[],
	wait: Callback[],
	change: ChangeCallback[],
	restore: Callback[]
} = {
	fetch: [],
	receive: [],
	wait: [],
	change: [],
	restore: []
};

////////// HELPERS //////////


function removeHash(url: string): string {
	const index = url.indexOf('#');
	if (index < 0) {
		return url;
	}
	return url.substr(0, index);
}

function getLinkTarget(target: Element): HTMLAnchorElement {
	while (target && target.nodeName != 'A') {
		target = <Element>target.parentNode;
	}
	return <HTMLAnchorElement>target;
}

function isBlacklisted(elem: Element): boolean {
	do {
		if (!elem.hasAttribute) break; // Parent of <html>
		if (elem.hasAttribute('data-instant')) return false;
		if (elem.hasAttribute('data-no-instant')) return true;
	} while ((elem = <Element>elem.parentNode));
	return false;
}

function isPreloadable(a: HTMLAnchorElement): boolean {
	const domain = location.protocol + '//' + location.host;

	if (a.target // target="_blank" etc.
		|| a.hasAttribute('download')
		|| a.href.indexOf(domain + '/') != 0 // Another domain, or no href attribute
		|| (a.href.includes('#') && removeHash(a.href) == $currentLocationWithoutHash) // Anchor
		|| isBlacklisted(a)
	) {
		return false;
	}
	return true;
}

function triggerPageEvent(eventType: string, arg1?, arg2?, arg3?) {
	let returnValue;
	for (const callback of $eventsCallbacks[eventType]) {
		if (eventType == 'receive') {
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
		} else {
			callback(arg1, arg2, arg3);
		}
	}
	return returnValue;
}

function changePage(title: string, body, newUrl: string, scrollY?: number, pop?: boolean) {
	document.documentElement.replaceChild(body, document.body);
	/* We cannot just use `document.body = doc.body`, it causes Safari (tested
		 5.1, 6.0 and Mobile 7.0) to execute script tags directly.
	*/

	if (newUrl) {
		if (location.href !== newUrl) {
			history.pushState(null, null, newUrl);
		}
		const hashIndex: number = newUrl.indexOf('#');
		let offset: number = 0;
		let hashElem = hashIndex > -1
			&& document.getElementById(newUrl.substr(hashIndex + 1));


		if (hashElem) {
			while (hashElem.offsetParent) {
				offset += hashElem.offsetTop;
				hashElem = <HTMLElement> hashElem.offsetParent;
			}
		}
		scrollTo(0, offset);

		$currentLocationWithoutHash = removeHash(newUrl);
	} else {
		scrollTo(0, scrollY);
	}

	if ($isChromeForIOS && document.title === title) {
		/* Chrome for iOS:
		 *
		 * 1. Removes title on pushState, so the title needs to be set after.
		 *
		 * 2. Will not set the title if it's identical when trimmed, so
		 *    appending a space won't do; but a non-breaking space works.
		 */
		document.title = title + String.fromCharCode(160);
	} else {
		document.title = title;
	}

	instantanize();
	if (pop) {
		triggerPageEvent('restore');
	} else {
		triggerPageEvent('change', false);
	}
}

function setPreloadingAsHalted() {
	$isPreloading = false;
	$isWaitingForCompletion = false;
}

function removeNoscriptTags(html: string): string {
	/* Must be done on text, not on a node's innerHTML, otherwise strange
	 * things happen with implicitly closed elements (see the Noscript test).
	 */
	return html.replace(/<noscript[\s\S]+?<\/noscript>/gi, '');
}


////////// EVENT LISTENERS //////////


function mousedownListener(e: MouseEvent) {
	if ($lastTouchTimestamp > (Date.now() - 500)) {
		return; // Otherwise, click doesn't fire
	}

	const a = getLinkTarget(<HTMLAnchorElement>e.target);
	if (!a || !isPreloadable(a)) return;

	preload(a.href);
}

function mouseoverListener(e) {
	if ($lastTouchTimestamp > (Date.now() - 500)) {
		return; // Otherwise, click doesn't fire
	}

	const a = getLinkTarget(e.target);
	if (!a || !isPreloadable(a)) return;

	a.addEventListener('mouseout', mouseoutListener);

	if (!$delayBeforePreload) {
		preload(a.href);
	} else {
		$urlToPreload = a.href;
		$preloadTimer = setTimeout(preload, $delayBeforePreload);
	}
}

function touchstartListener(e) {
	$lastTouchTimestamp = Date.now();

	const a = getLinkTarget(e.target);
	if (!a || !isPreloadable(a)) return;

	if ($preloadOnMousedown) {
		a.removeEventListener('mousedown', mousedownListener);
	}	else {
		a.removeEventListener('mouseover', mouseoverListener);
	}
	preload(a.href);
}

function clickListener(e) {
	const a = getLinkTarget(e.target);
	if (!a || !isPreloadable(a)) return;

	if (e.which > 1 || e.metaKey || e.ctrlKey) { // Opening in new tab
		return;
	}
	e.preventDefault();
	display(a.href);
}

function mouseoutListener() {
	if ($preloadTimer) {
		clearTimeout($preloadTimer);
		$preloadTimer = undefined;
		return;
	}

	if (!$isPreloading || $isWaitingForCompletion) {
		return;
	}
	$xhr.abort();
	setPreloadingAsHalted();
}

function readystatechangeListener() {
	if ($xhr.readyState < 4) return;
	if ($xhr.status == 0) return; /* Request aborted */

	$timing.ready = Date.now() - $timing.start;

	if ($xhr.getResponseHeader('Content-Type').match(/\/(x|ht|xht)ml/)) {
		const doc = document.implementation.createHTMLDocument('');
		doc.documentElement.innerHTML = removeNoscriptTags($xhr.responseText);
		$title = doc.title;
		$body = <HTMLBodyElement>doc.body;

		const alteredOnReceive = triggerPageEvent('receive', $url, $body, $title);
		if (alteredOnReceive) {
			if (alteredOnReceive.body !== undefined) {
				$body = alteredOnReceive.body;
			}
			if (alteredOnReceive.title !== undefined) {
				$title = alteredOnReceive.title;
			}
		}

		const urlWithoutHash = removeHash($url);
		$history[urlWithoutHash] = {
			body: $body,
			title: $title,
			scrollY: urlWithoutHash in $history ? $history[urlWithoutHash].scrollY : 0
		};

		const elems = <HTMLElement[]><any>doc.head.children;
		let found = 0;

		for (const elem of elems) {
			if (elem.hasAttribute('data-instant-track')) {
				const data = elem.getAttribute('href')
					|| elem.getAttribute('src')
					|| elem.innerHTML;

				for (const asset of $trackedAssets) {
					if (asset === data) found++;
				}
			}
		}
		if (found !== $trackedAssets.length) {
			$mustRedirect = true; // Assets have changed
		}
	} else {
		$mustRedirect = true; // Not an HTML document
	}

	if ($isWaitingForCompletion) {
		$isWaitingForCompletion = false;
		display($url);
	}
}

function popstateListener() {
	const loc = removeHash(location.href);
	if (loc == $currentLocationWithoutHash) return;

	if (!(loc in $history)) {
		location.href = location.href;
		/* Reloads the page while using cache for scripts, styles and images,
			 unlike `location.reload()` */
		return;
	}

	$history[$currentLocationWithoutHash].scrollY = pageYOffset;
	$currentLocationWithoutHash = loc;
	changePage(
		$history[loc].title,
		$history[loc].body,
		'',
		$history[loc].scrollY,
		true
	);
}

////////// MAIN FUNCTIONS //////////
function syncload(scripts, i) {
	if (i < scripts.length) {
		const script = scripts[i];
		if (script.hasAttribute('data-no-instant')) {
			syncload(scripts, i + 1);
			return;
		}
		const copy = document.createElement('script');
		if (script.src) {
			copy.src = script.src;
		}
		if (script.innerHTML) {
			copy.innerHTML = script.innerHTML;
		}
		const { parentNode, nextSibling } = script;
		parentNode.removeChild(script);
		parentNode.insertBefore(copy, nextSibling);
		copy.onload = function () {
			syncload(scripts, i + 1);
		};
	}
}

function instantanize(isInitializing?: boolean) {
	const { body } = document;
	body.addEventListener('touchstart', touchstartListener, true);
	if ($preloadOnMousedown) {
		body.addEventListener('mousedown', mousedownListener, true);
	} else {
		body.addEventListener('mouseover', mouseoverListener, true);
	}
	body.addEventListener('click', clickListener, true);

	if (!isInitializing) {
		syncload(body.getElementsByTagName('script'), 0);
	}
}

export function preload(url: string) {
	if (!$preloadOnMousedown
			&& 'display' in $timing
			&& Date.now() - ($timing.start + $timing.display) < 100) {
		/* After a page is displayed, if the user's cursor happens to be above
			 a link a mouseover event will be in most browsers triggered
			 automatically, and in other browsers it will be triggered when the
			 user moves his mouse by 1px.

			 Here are the behavior I noticed, all on Windows:
			 - Safari 5.1: auto-triggers after 0 ms
			 - IE 11: auto-triggers after 30-80 ms (depends on page's size?)
			 - Firefox: auto-triggers after 10 ms
			 - Opera 18: auto-triggers after 10 ms

			 - Chrome: triggers when cursor moved
			 - Opera 12.16: triggers when cursor moved

			 To remedy to this, we do not start preloading if last display
			 occurred less than 100 ms ago.
		*/

		return;
	}
	if ($preloadTimer) {
		clearTimeout($preloadTimer);
		$preloadTimer = undefined;
	}

	if (!url) {
		url = $urlToPreload;
	}

	if ($isPreloading && (url == $url || $isWaitingForCompletion)) {
		return;
	}
	$isPreloading = true;
	$isWaitingForCompletion = false;

	$url = url;
	$body = undefined;
	$mustRedirect = false;
	$timing = {
		start: Date.now()
	};
	triggerPageEvent('fetch');
	$xhr.open('GET', url);
	$xhr.send();
}

function display(url: string) {
	if (!('display' in $timing)) {
		$timing.display = Date.now() - $timing.start;
	}
	if ($preloadTimer || !$isPreloading) {
		/* $preloadTimer:
			 Happens when there's a delay before preloading and that delay
			 hasn't expired (preloading didn't kick in).

			 !$isPreloading:
			 A link has been clicked, and preloading hasn't been initiated.
			 It happens with touch devices when a user taps *near* the link,
			 Safari/Chrome will trigger mousedown, mouseover, click (and others),
			 but when that happens we ignore mousedown/mouseover (otherwise click
			 doesn't fire). Maybe there's a way to make the click event fire, but
			 that's not worth it as mousedown/over happen just 1ms before click
			 in this situation.

			 It also happens when a user uses his keyboard to navigate (with Tab
			 and Return), and possibly in other non-mainstream ways to navigate
			 a website.
		*/

		if ($preloadTimer && $url && $url != url) {
			/* Happens when the user clicks on a link before preloading
				 kicks in while another link is already preloading.
			*/

			location.href = url;
			return;
		}

		preload(url);
		triggerPageEvent('wait');
		$isWaitingForCompletion = true; // Must be set *after* calling `preload`
		return;
	}
	if ($isWaitingForCompletion) {
		/* The user clicked on a link while a page was preloading. Either on
			 the same link or on another link. If it's the same link something
			 might have gone wrong (or he could have double clicked, we don't
			 handle that case), so we send him to the page without pjax.
			 If it's another link, it hasn't been preloaded, so we redirect the
			 user to it.
		*/
		location.href = url;
		return;
	}
	if ($mustRedirect) {
		location.href = $url;
		return;
	}
	if (!$body) {
		triggerPageEvent('wait');
		$isWaitingForCompletion = true;
		return;
	}
	$history[$currentLocationWithoutHash].scrollY = pageYOffset;
	setPreloadingAsHalted();
	changePage($title, $body, $url);
}


////////// PUBLIC VARIABLE AND FUNCTIONS //////////

export const supported = history.pushState
	&& (!$userAgent.match('Android') || $userAgent.match('Chrome/'))
	&& location.protocol != 'file:';

/* The (sad) state of Android's AOSP browsers:

	 2.3.7: pushState appears to work correctly, but
					`doc.documentElement.innerHTML = body` is buggy.
					Update: InstantClick doesn't use that anymore, but it may
					fail where 3.0 do, this needs testing again.

	 3.0:   pushState appears to work correctly (though the address bar is
					only updated on focus), but
					`document.documentElement.replaceChild(doc.body, document.body)`
					throws DOMException: WRONG_DOCUMENT_ERR.

	 4.0.2: Doesn't support pushState.

	 4.0.4,
	 4.1.1,
	 4.2,
	 4.3:   Claims support for pushState, but doesn't update the address bar.

	 4.4:   Works correctly. Claims to be 'Chrome/30.0.0.0'.

	 All androids tested with Android SDK's Emulator.
	 Version numbers are from the browser's user agent.

	 Because of this mess, the only whitelisted browser on Android is Chrome.
*/

export function init(preloadingMode) {
	if ($currentLocationWithoutHash) {
		/* Already initialized */
		return;
	}
	if (!supported) {
		triggerPageEvent('change', true);
		return;
	}

	if (preloadingMode == 'mousedown') {
		$preloadOnMousedown = true;
	}
	else if (typeof preloadingMode == 'number') {
		$delayBeforePreload = preloadingMode;
	}

	$currentLocationWithoutHash = removeHash(location.href);
	$history[$currentLocationWithoutHash] = {
		body: document.body,
		title: document.title,
		scrollY: pageYOffset
	};

	const elems = <HTMLElement[]><any>document.head.children;
	for (const elem of elems) {
		if (elem.hasAttribute('data-instant-track')) {
			const data = elem.getAttribute('href') || elem.getAttribute('src') || elem.innerHTML;
			/* We can't use just `elem.href` and `elem.src` because we can't
				 retrieve `href`s and `src`s from the Ajax response.
			*/
			$trackedAssets.push(data);
		}
	}

	$xhr = new XMLHttpRequest();
	$xhr.addEventListener('readystatechange', readystatechangeListener);

	instantanize(true);

	triggerPageEvent('change', true);

	addEventListener('popstate', popstateListener);
}

export function on(eventType: 'fetch', callback: Callback): void;
export function on(eventType: 'receive', callback: ReceiveCallback): void;
export function on(eventType: 'wait', callback: Callback): void;
export function on(eventType: 'change', callback: ChangeCallback): void;
export function on(eventType: 'restore', callback: Callback): void;

export function on(eventType: string, callback) {
	$eventsCallbacks[eventType].push(callback);
}

export function off(eventType: string) {
	$eventsCallbacks[eventType] = [];
}
