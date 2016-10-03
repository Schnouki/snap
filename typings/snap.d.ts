type PageEvent = 'fetch' | 'receive' | 'restore' | 'change' | 'wait' | 'progress';
type PreloadMode = 'mousedown' | 'mouseover';
type Callback = () => any;

interface ProgressCallback {
	(loaded: number, total: number): any;
}
interface ReceiveCallback {
	(url: string, body: HTMLBodyElement, title: string): (boolean|{
		body?: HTMLBodyElement,
		title?: string
	});
}
interface ChangeCallback {
	(isInitialLoad: boolean): any;
}

interface HistoryRecord {
	body: HTMLBodyElement;
	title: string;
	scrollY?: number;
}

interface Config {
	preloadMode?: PreloadMode;
	delay?: number;
	static?: boolean;
	rootSelector?: string;
}

declare module '@alexlur/snap' {
	export function init(config: Config): void;
	export function preload(url: string): void;
	export function on(eventType: 'fetch', callback: Callback): void;
	export function on(eventType: 'receive', callback: ReceiveCallback): void;
	export function on(eventType: 'wait', callback: Callback): void;
	export function on(eventType: 'change', callback: ChangeCallback): void;
	export function on(eventType: 'restore', callback: Callback): void;
	export function on(eventType: 'progress', callback: ProgressCallback): void;
	export function off(eventType: string): void;

	export const supported: boolean;
}

declare module 'package.json' {
	export const version: number;
}
