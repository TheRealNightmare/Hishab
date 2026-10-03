<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'default' | 'danger' | 'ghost' | 'green' | 'blue';
	let {
		variant = 'default',
		size = 'md',
		href,
		class: klass = '',
		children,
		...rest
	}: HTMLButtonAttributes & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; href?: string; download?: boolean | string; children: Snippet } = $props();

	const colors: Record<Variant, string> = {
		primary: 'bg-yellow text-ink',
		default: 'bg-bg0h text-ink',
		danger: 'bg-red text-bg0h',
		ghost: 'bg-transparent text-ink',
		green: 'bg-green text-ink',
		blue: 'bg-blue text-bg0h'
	};
	const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
	const cls = $derived(
		`nb-press inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wide select-none cursor-pointer ${colors[variant]} ${sizes[size]} ${klass}`
	);
</script>

{#if href}
	<a {href} class={cls} {...rest as Record<string, unknown>}>{@render children()}</a>
{:else}
	<button type="button" class={cls} {...rest}>{@render children()}</button>
{/if}
