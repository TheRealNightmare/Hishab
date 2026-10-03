<script lang="ts">
	import type { Snippet } from 'svelte';
	let { label, hint, class: klass = '', children }: { label: string; hint?: string; class?: string; children: Snippet } = $props();
</script>

<label class="block {klass}">
	<span class="nb-label">{label}</span>
	{@render children()}
	{#if hint}<span class="mt-1 block text-xs text-muted">{hint}</span>{/if}
</label>
