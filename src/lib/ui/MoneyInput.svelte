<script lang="ts">
	import { toPaisa } from '#lib/domain/money';

	/** Two-way bound value in paisa (null/undefined when empty). No fallback: parents may bind to a missing record key. */
	let {
		value = $bindable(),
		big = false,
		placeholder = '0',
		required = false,
		autofocus = false,
		id
	}: { value?: number | null | undefined; big?: boolean; placeholder?: string; required?: boolean; autofocus?: boolean; id?: string } = $props();

	const fmt = (p: number | null | undefined) => (p == null ? '' : String(p / 100));
	let text = $state(fmt(value));
	let last = value;

	// Sync when parent changes value (e.g. preset), without fighting the user's typing.
	$effect(() => {
		if ((value ?? null) !== (last ?? null)) {
			text = fmt(value);
			last = value;
		}
	});

	function oninput() {
		// Allow quick sums like "120+45-10" for splitting bills.
		let v: number | null;
		if (/^\s*[\d.,]+(\s*[+-]\s*[\d.,]+)+\s*$/.test(text)) {
			const parts = text.replace(/\s/g, '').match(/[+-]?[\d.,]+/g) ?? [];
			const sum = parts.reduce((acc, p) => acc + (toPaisa(p) ?? NaN), 0);
			v = Number.isFinite(sum) && sum > 0 ? sum : null;
		} else v = toPaisa(text);
		last = v;
		value = v;
	}
</script>

<div class="relative">
	<span class="money pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-bold text-muted {big ? 'text-3xl' : ''}">৳</span>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		{id}
		class="nb-input money {big ? 'py-3 pl-10 text-4xl font-extrabold' : 'pl-8'}"
		inputmode="decimal"
		autocomplete="off"
		{placeholder}
		{required}
		{autofocus}
		bind:value={text}
		{oninput}
	/>
</div>
