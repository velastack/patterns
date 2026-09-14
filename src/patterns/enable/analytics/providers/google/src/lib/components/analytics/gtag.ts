import { browser } from '$app/environment';

declare global {
	interface Window {
		dataLayer: unknown[];
	}
}

let configured = false;

/**
 * Google's `gtag()`: pushes the `arguments` object onto `dataLayer`, which
 * gtag.js drains once it has loaded. It has to be `arguments`, not a rest
 * array; gtag.js ignores plain arrays. Call it from anywhere in the app:
 * `gtag('event', 'sign_up', { method: 'email' })`.
 */
export function gtag(..._args: unknown[]): void {
	window.dataLayer = window.dataLayer ?? [];
	// eslint-disable-next-line prefer-rest-params
	window.dataLayer.push(arguments);
}

/** Configures the tag on first use, then reports the current page. */
export function pageView(measurementId: string): void {
	if (!browser || !measurementId) return;
	if (!configured) {
		gtag('js', new Date());
		gtag('config', measurementId, { send_page_view: false });
		configured = true;
	}
	gtag('event', 'page_view', {
		page_location: location.href,
		page_title: document.title
	});
}
