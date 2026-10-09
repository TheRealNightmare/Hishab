/** True when the user asked the OS for less motion; Svelte's JS transitions don't see the CSS media query. */
export function reducedMotion(): boolean {
	try {
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

/** Duration that collapses to 0 under reduced motion. */
export const ms = (n: number) => (reducedMotion() ? 0 : n);
