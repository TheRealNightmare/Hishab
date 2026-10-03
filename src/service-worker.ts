/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `hishab-${version}`;
const SHELL = '/';
const PRECACHE = [...immutable, ...assets].map((f) => f.path);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;
	// Financial data is never cached; Access login redirects must reach the browser untouched.
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/cdn-cgi/')) return;

	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((r) => r ?? fetch(req)));
		return;
	}

	if (req.mode === 'navigate') {
		// Network first; remember the app shell so the UI opens offline (data still needs network).
		event.respondWith(
			fetch(req)
				.then(async (res) => {
					if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(SHELL, res.clone());
					return res;
				})
				.catch(async () => (await caches.match(SHELL)) ?? Response.error())
		);
	}
});
