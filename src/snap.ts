import {
	removeHash,
	removeNoscriptTags,
	setPreloadingAsHalted
} from './util';

import * as listeners from './listeners';
import {
	$preloadTimer,
	clearTimer,
	attachListeners
} from './listeners';

import {
	trigger
} from './callbacks';

// Internal variables
const $isChromeForIOS: boolean = navigator.userAgent.includes(' CriOS/');

// Preloading-related variables;
export const $history: Map<string, HistoryRecord> = new Map;
export const $cache: Map<string, HistoryRecord> = new Map;
export let $xhr: XMLHttpRequest;
export const $page = {
	url: '',
	title: '',
	body: <HTMLElement> undefined
};

export const $state = {
	isPreloading: false,
	isWaitingForCompletion: false,
	mustRedirect: false,
	hashlessLocation: '',
	urlToPreload: ''
};

export let $timing: {
	start?: number,
	ready?: number,
	display?: number
} = {};

export const $trackedAssets: Set<HTMLElement|string> = new Set();

// Variables defined by public functions;
let $isDynamic = true;
export let $preloadMode: PreloadMode = 'mouseover';
export let $delayBeforePreload: number;
export let $rootSelector: string;

////////// HELPERS //////////

export function changePage(title: string, body, newUrl: string, scrollY?: number, pop?: boolean) {
	let target = document.body;
	if ($rootSelector)
		target = target.querySelector($rootSelector);

	target.parentNode.replaceChild(body, target);
	// We cannot just use `document.body = doc.body`, it causes Safari (tested
	// 5.1, 6.0 and Mobile 7.0) to execute script tags directly.

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

		$state.hashlessLocation = removeHash(newUrl);

		if ($isDynamic) {
			$cache.clear();
		}
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

	attachListeners();
	if (pop) {
		trigger('restore');
	} else {
		trigger('change', false);
	}
}

////////// MAIN FUNCTIONS //////////

export function preload(url: string) {
	if ($preloadMode !== 'mousedown'
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

	clearTimer();

	if (!url) {
		url = $state.urlToPreload;
	}

	if ($state.isPreloading && (url === $page.url || $state.isWaitingForCompletion)) return;
	if ($cache.has(url)) return;

	$state.isPreloading = true;
	$state.isWaitingForCompletion = false;

	$page.url = url;
	$page.body = undefined;
	$state.mustRedirect = false;
	$timing = {
		start: Date.now()
	};
	trigger('fetch', $page.url);
	$xhr.open('GET', url);
	$xhr.send();
}


export function display(url: string) {
	if (!('display' in $timing)) {
		$timing.display = Date.now() - $timing.start;
	}

	if ($cache.has(url)) {
		const { body, title } = $cache.get(url);
		$page.body = body;
		$page.title = title;
		$page.url = url;

		$history.get($state.hashlessLocation).scrollY = pageYOffset;
		setPreloadingAsHalted();
		changePage(title, body, url);
		return;
	}

	if ($preloadTimer || !$state.isPreloading) {
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

		if ($preloadTimer && $page.url && $page.url !== url) {
			/* Happens when the user clicks on a link before preloading
				 kicks in while another link is already preloading.
			*/

			location.href = url;
			return;
		}

		preload(url);
		trigger('wait');
		$state.isWaitingForCompletion = true; // Must be set *after* calling `preload`
		return;
	}
	if ($state.isWaitingForCompletion) {
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
	if ($state.mustRedirect) {
		location.href = $page.url;
		return;
	}

	if (!$page.body) {
		trigger('wait');
		$state.isWaitingForCompletion = true;
		return;
	}

	$history.get($state.hashlessLocation).scrollY = pageYOffset;
	setPreloadingAsHalted();
	changePage($page.title, $page.body, $page.url);
}


////////// PUBLIC VARIABLE AND FUNCTIONS //////////

export const supported = history.pushState
	&& typeof Map === 'function'
	&& location.protocol !== 'file:';

export function init(config: Config = {}) {
	if ($state.hashlessLocation) {
		/* Already initialized */
		return;
	}
	if (!supported) {
		trigger('change', true);
		return;
	}

	if (config.preloadMode) {
		$preloadMode = config.preloadMode;
	}

	if ($preloadMode !== 'mousedown' && typeof config.delay === 'number') {
		$delayBeforePreload = config.delay;
	}

	$isDynamic = !config.static;
	$rootSelector = config.rootSelector || null;

	$state.hashlessLocation = removeHash(location.href);
	const record: HistoryRecord = {
		body: <HTMLElement> document.body,
		title: document.title,
		scrollY: pageYOffset
	};

	$history.set($state.hashlessLocation, record);
	$cache.set($state.hashlessLocation, record);

	const elems = document.head.children;
	for (const elem of elems) {
		if (elem.hasAttribute('data-instant-track')) {
			const data = elem.getAttribute('href')
				|| elem.getAttribute('src')
				|| elem.innerHTML;
			/* We can't use just `elem.href` and `elem.src` because we can't
				 retrieve `href`s and `src`s from the Ajax response.
			*/
			$trackedAssets.add(data);
		}
	}

	$xhr = new XMLHttpRequest();
	$xhr.addEventListener('readystatechange', listeners.readystatechange);
	$xhr.addEventListener('progress', listeners.progress);

	attachListeners(true);

	trigger('change', true);

	addEventListener('popstate', listeners.popstate);
}
