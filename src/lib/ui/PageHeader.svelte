<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, back, sub, actions }: { title: string; back?: string; sub?: string; actions?: Snippet } = $props();
</script>

<header class="mb-4 flex items-end justify-between gap-3">
	<div class="min-w-0">
		{#if back}
			<a href={back} class="mb-1 inline-block text-xs font-bold tracking-wider uppercase text-muted hover:text-ink">← Back</a>
		{/if}
		<h1 class="nb-title truncate text-3xl sm:text-4xl">{title}</h1>
		{#if sub}<p class="mt-1 text-sm text-muted">{sub}</p>{/if}
	</div>
	{#if actions}<div class="flex shrink-0 gap-2">{@render actions()}</div>{/if}
</header>
