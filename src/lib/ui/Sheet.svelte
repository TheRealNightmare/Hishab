<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';

	let {
		open = $bindable(false),
		title,
		onclose,
		children
	}: { open: boolean; title: string; onclose?: () => void; children: Snippet } = $props();

	function close() {
		open = false;
		onclose?.();
	}
	function onkeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}
	$effect(() => {
		document.body.style.overflow = open ? 'hidden' : '';
		return () => (document.body.style.overflow = '');
	});
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-40 bg-ink/40" transition:fade={{ duration: 120 }} onclick={close} role="presentation"></div>
	<div
		class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[10px] border-2 border-b-0 border-ink bg-bg shadow-[0_-4px_0_0_var(--color-ink)] sm:bottom-6 sm:rounded-[6px] sm:border-b-2 sm:shadow-hard-lg"
		transition:fly={{ y: 400, duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<div class="flex items-center justify-between border-b-2 border-ink bg-yellow px-4 py-3 sm:rounded-t-[4px]">
			<h2 class="nb-title text-xl">{title}</h2>
			<button class="nb-press bg-bg0h px-2 py-0.5 font-bold" onclick={close} aria-label="Close">✕</button>
		</div>
		<div class="overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
			{@render children()}
		</div>
	</div>
{/if}
