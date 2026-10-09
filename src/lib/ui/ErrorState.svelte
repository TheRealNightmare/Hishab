<script lang="ts">
	import Button from './Button.svelte';
	let { onretry, title = "Couldn't load this" }: { onretry: () => void; title?: string } = $props();
</script>

<div class="nb-flat flex flex-col items-center gap-3 border-dashed bg-red/10 p-6 text-center" role="alert">
	<div class="text-3xl">⚠️</div>
	<div class="font-bold">{title}</div>
	<p class="text-sm text-muted">Check your connection and try again.</p>
	<Button variant="primary" onclick={onretry}>Retry</Button>
</div>
