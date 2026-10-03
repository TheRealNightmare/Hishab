<script lang="ts">
	import type { Snippet } from 'svelte';
	let { label, bg = 'var(--color-bg0h)', children, sub }: { label: string; bg?: string; children: Snippet; sub?: Snippet } = $props();
</script>

<div class="nb-card p-3" style="background:{bg}">
	<div class="text-[0.7rem] font-bold tracking-wider uppercase opacity-80">{label}</div>
	<div class="mt-1 text-xl leading-tight sm:text-2xl">{@render children()}</div>
	{#if sub}<div class="mt-1 text-xs opacity-80">{@render sub()}</div>{/if}
</div>
