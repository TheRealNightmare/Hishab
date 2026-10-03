<script lang="ts">
	import type { Snippet } from 'svelte';
	let { icon = '🗒️', title, children }: { icon?: string; title: string; children?: Snippet } = $props();
</script>

<div class="nb-flat flex flex-col items-center gap-2 border-dashed p-6 text-center">
	<div class="text-3xl">{icon}</div>
	<div class="font-bold">{title}</div>
	{#if children}<div class="text-sm text-muted">{@render children()}</div>{/if}
</div>
