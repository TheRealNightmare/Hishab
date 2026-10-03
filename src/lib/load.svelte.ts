import { data } from './stores.svelte';

/**
 * Fetch data for a page and re-fetch whenever anything is saved (data.version) or any
 * reactive state read synchronously inside `fn` changes (e.g. a selected month).
 */
export function loader<T>(fn: () => Promise<T>) {
	const s = $state({ value: null as T | null, loading: true, error: false });
	$effect(() => {
		void data.version;
		let stale = false;
		s.loading = true;
		fn()
			.then((v) => {
				if (!stale) Object.assign(s, { value: v, loading: false, error: false });
			})
			.catch(() => {
				if (!stale) Object.assign(s, { loading: false, error: true });
			});
		return () => (stale = true);
	});
	return s;
}
