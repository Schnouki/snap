import {
	display,
	preload,
	changePage,

	$xhr,
	$page,
	$cache,
	$state,
	$timing,
	$history,
	$preloadMode,
	$trackedAssets,
	$delayBeforePreload,
} from './snap';

import {
	syncload,
	removeHash,
	fetchImages,
	getLinkTarget,
	isPreloadable,
	removeNoscriptTags,
	setPreloadingAsHalted
} from './util';

import {
	trigger
} from './callbacks';

let $lastTouchTimestamp: number;
export let $preloadTimer: number;

export function clearTimer() {
	clearTimeout($preloadTimer);
	$preloadTimer = undefined;
}

export function mousedown(e: MouseEvent) {
	if ($lastTouchTimestamp > (Date.now() - 500)) {
		return; // Otherwise, click doesn't fire
	}

	const a = getLinkTarget(<HTMLAnchorElement>e.target);
	if (!a || !isPreloadable(a)) return;

	preload(a.href);
}

export function mouseover(e: MouseEvent) {
	if ($lastTouchTimestamp > (Date.now() - 500)) {
		return; // Otherwise, click doesn't fire
	}

	const a = getLinkTarget(<HTMLAnchorElement>e.target);
	if (!a || !isPreloadable(a)) return;

	a.addEventListener('mouseout', mouseout);

	if (!$delayBeforePreload) {
		preload(a.href);
	} else {
		$state.urlToPreload = a.href;
		$preloadTimer = setTimeout(preload, $delayBeforePreload);
	}
}

export function touchstart(e: TouchEvent) {
	$lastTouchTimestamp = Date.now();

	const a = getLinkTarget(<HTMLAnchorElement>e.target);
	if (!a || !isPreloadable(a)) return;

	a.removeEventListener(
		$preloadMode,
		$preloadMode === 'mousedown'
			? mousedown
			: mouseover
	);
	preload(a.href);
}

export function click(e: MouseEvent) {
	const a = getLinkTarget(<HTMLAnchorElement>e.target);
	if (!a || !isPreloadable(a)) return;

	if (e.which > 1 || e.metaKey || e.ctrlKey) { // Opening in new tab
		return;
	}
	e.preventDefault();
	display(a.href);
}

function mouseout() {
	if ($preloadTimer) {
		clearTimer();
		return;
	}

	if (!$state.isPreloading || $state.isWaitingForCompletion) {
		return;
	}
	$xhr.abort();
	setPreloadingAsHalted();
}

export function readystatechange() {
	if ($xhr.readyState < 4) return;
	if ($xhr.status === 0) return; /* Request aborted */

	$timing.ready = Date.now() - $timing.start;

	if (/\/(x|ht|xht)ml/.test($xhr.getResponseHeader('Content-Type'))) {
		const doc = document.implementation.createHTMLDocument('');
		doc.documentElement.innerHTML = removeNoscriptTags($xhr.responseText);
		$page.title = doc.title;
		$page.body = <HTMLBodyElement>doc.body;

		const alteredOnReceive = trigger(
			'receive', $page.url, $page.body, $page.title
		);
		if (alteredOnReceive) {
			if (alteredOnReceive.body !== undefined) {
				$page.body = alteredOnReceive.body;
			}
			if (alteredOnReceive.title !== undefined) {
				$page.title = alteredOnReceive.title;
			}
		}

		const urlWithoutHash = removeHash($page.url);
		const record: HistoryRecord = {
			body: $page.body,
			title: $page.title,
			scrollY: $history.has(urlWithoutHash) ? $history.get(urlWithoutHash).scrollY : 0
		};

		$history.set(urlWithoutHash, record);
		$cache.set(urlWithoutHash, record);

		fetchImages(doc.images);

		const elems = <HTMLElement[]><any>doc.head.children;
		let found = 0;

		for (const elem of elems) {
			if (elem.hasAttribute('data-instant-track')) {
				const data = elem.getAttribute('href')
					|| elem.getAttribute('src')
					|| elem.innerHTML;

				if ($trackedAssets.has(data)) found++;
			}
		}
		if (found !== $trackedAssets.size) {
			$state.mustRedirect = true; // Assets have changed
		}
	} else {
		$state.mustRedirect = true; // Not an HTML document
	}

	if ($state.isWaitingForCompletion) {
		$state.isWaitingForCompletion = false;
		display($page.url);
	}
}

export function popstate() {
	const loc = removeHash(location.href);
	if (loc === $state.hashlessLocation) return;

	if (!$history.has(loc)) {
		location.href = location.href;
		// Reloads the page while using cache for scripts, styles and images,
		// unlike `location.reload()`
		return;
	}

	$history.get($state.hashlessLocation).scrollY = pageYOffset;
	$state.hashlessLocation = loc;
	changePage(
		$history.get(loc).title,
		$history.get(loc).body,
		'',
		$history.get(loc).scrollY,
		true
	);
}

export function progress(e: ProgressEvent) {
	if (e.lengthComputable) {
		trigger('progress', e.loaded, e.total);
	}
}

export function attachListeners(isInitializing?: boolean) {
	const { body } = document;
	body.addEventListener('touchstart', touchstart, true);
	body.addEventListener('click', click, true);
	body.addEventListener(
		$preloadMode,
		$preloadMode === 'mousdown' ? mousedown : mouseover,
		true
	);

	if (!isInitializing) {
		syncload(body.getElementsByTagName('script'), 0);
	}
}
