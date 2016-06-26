/* Based on InstantClick's loading indicator
 * (C) 2014-2015 Alexandre Dieulot
 * http://instantclick.io/license
 */

/* global orientation */

import { on } from './callbacks';
import { supported } from './snap';

let $container: HTMLDivElement;
let $element: HTMLDivElement;
let $progress: number = 0;
let $timer: number;
let $hasTouch: boolean = 'createTouch' in document;

function init() {
	$container = document.createElement('div');
	$container.id = 'instantclick';
	$element = document.createElement('div');
	$element.id = 'instantclick-bar';
	$container.appendChild($element);

	const styleElement = document.createElement('style');
	styleElement.innerHTML = '#instantclick{color:#29d;position:' + ($hasTouch ? 'absolute' : 'fixed') + ';top:0;left:0;width:100%;pointer-events:none;z-index:2147483647;transition:opacity 1s}\n' +
	'#instantclick-bar{background:currentColor;width:100%;margin-left:-100%;height:2px;transition:all 1s}';
	document.head.insertBefore(styleElement, document.head.firstChild);

	if ($hasTouch) {
		updatePositionAndScale();
		window.addEventListener('resize', updatePositionAndScale);
		window.addEventListener('scroll', updatePositionAndScale);
	}
}

function start() {
	$progress = 0;
	$container.style.opacity = '0';
	update();
	setTimeout(display, 0); // Done in a timer to do that on next frame, so that the CSS animation happens
	$timer = setTimeout(inc, 500);
}

function display() {
	$progress = 10;
	$container.style.opacity = '1';
	update();
}

function inc() {
	$progress += 1 + (Math.random() * 2);
	if ($progress > 99) {
		$progress = 99;
	} else {
		$timer = setTimeout(inc, 500);
	}
	update();
}

function update() {
	$element.style.transform = 'translate(' + $progress + '%)';
	if (!document.getElementById($container.id)) {
		document.body.appendChild($container);
	}
}

function done() {
	clearTimeout($timer);
}

function remove() {
	if (document.getElementById($container.id)) {
		document.body.removeChild($container);
	}
}

function updatePositionAndScale() {
	/* Adapted from code by Sam Stephenson and Mislav Marohnic
		 http://signalvnoise.com/posts/2407
	*/

	$container.style.left = pageXOffset + 'px';
	$container.style.width = document.body.clientWidth + 'px';
	$container.style.top = pageYOffset + 'px';

	const landscape: boolean = 'orientation' in window && Math.abs(<number>orientation) === 90;
	const scaleY: number = innerWidth / screen[landscape ? 'height' : 'width'] * 1.34;
	/* We multiply the size by 2 because the progress bar is harder
		 to notice on a mobile device.
	*/
	$container.style.transform = 'scaleY(' + scaleY  + ')';
}

////////////////////
on('change', function (isInitialPage: boolean) {
	if (isInitialPage && supported) {
		init();
	} else if (!isInitialPage) {
		done();
	}
});

on('progress', function (loaded: number, total: number) {
	if ($timer != null) {
		clearTimeout($timer);
		$timer = undefined;
	}

	$progress = loaded / total;
	update();
});

on('wait', start);

on('restore', remove); // Should be removed in a `beforechange` event instead
