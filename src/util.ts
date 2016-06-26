import { $state } from './snap';

export function removeHash(url: string): string {
	const index = url.indexOf('#');
	return (index < 0) ? url : url.substr(0, index);
}

export function getLinkTarget(target: Element): HTMLAnchorElement {
	while (target && target.nodeName !== 'A') {
		target = <Element>target.parentNode;
	}
	return <HTMLAnchorElement>target;
}

export function isBlacklisted(elem: Element): boolean {
	do {
		if (!elem.hasAttribute) break; // Parent of <html>
		if (elem.hasAttribute('data-instant')) return false;
		if (elem.hasAttribute('data-no-instant')) return true;
	} while ((elem = <Element>elem.parentNode));
	return false;
}

export function isPreloadable(a: HTMLAnchorElement): boolean {
	const domain = location.protocol + '//' + location.host;

	if (a.target // target="_blank" etc.
		|| a.hasAttribute('download')
		|| !a.hasAttribute('href')
		|| a.getAttribute('href').indexOf('#') === 0
		|| a.href.indexOf(domain + '/') !== 0 // Another domain, or no href attribute
		|| (a.href.includes('#') && removeHash(a.href) === $state.hashlessLocation) // Anchor
		|| isBlacklisted(a)
	) {
		return false;
	}
	return true;
}

export function removeNoscriptTags(html: string): string {
	/* Must be done on text, not on a node's innerHTML, otherwise strange
	 * things happen with implicitly closed elements (see the Noscript test).
	 */
	return html.replace(/<noscript[\s\S]+?<\/noscript>/gi, '');
}

export function fetchImages(images: HTMLCollectionOf<HTMLImageElement>): HTMLImageElement[] {
	const results = [];
	for (const node of images) {
		const img = new Image();
		img.src = (<HTMLImageElement> node).src;
		results.push(results);
	}
	return results;
}

export function setPreloadingAsHalted() {
	$state.isPreloading = false;
	$state.isWaitingForCompletion = false;
}

export function syncload(scripts: NodeListOf<HTMLScriptElement>, i: number) {
	if (i < scripts.length) {
		const script = scripts[i];
		if (script.hasAttribute('data-no-instant')) {
			return syncload(scripts, i + 1);
		}
		const copy = document.createElement('script');
		if (script.src) {
			copy.src = script.src;
		}
		if (script.innerHTML) {
			copy.innerHTML = script.innerHTML;
		}
		const { parentNode, nextSibling } = script;
		copy.onload = function () {
			syncload(scripts, i + 1);
		};

		parentNode.removeChild(script);
		parentNode.insertBefore(copy, nextSibling);
	}
}
