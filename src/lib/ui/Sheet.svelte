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

	// Swipe the header down to dismiss (phones). Dragging past 100px closes; less springs back.
	let startY = $state<number | null>(null);
	let dragY = $state(0);
	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return;
		startY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (startY !== null) dragY = Math.max(0, e.clientY - startY);
	}
	function up() {
		if (startY === null) return;
		startY = null;
		if (dragY > 100) close();
		dragY = 0;
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="fixed inset-0 z-40 bg-ink/40" transition:fade={{ duration: 120 }} onclick={close} role="presentation"></div>
	<div
		class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[10px] border-2 border-b-0 border-ink bg-bg shadow-[0_-4px_0_0_var(--color-ink)] sm:bottom-6 sm:rounded-[6px] sm:border-b-2 sm:shadow-hard-lg"
		style:transform={dragY ? `translateY(${dragY}px)` : null}
		style:transition={startY === null ? 'transform 150ms ease' : 'none'}
		transition:fly={{ y: 400, duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<div
			class="relative flex touch-none items-center justify-between border-b-2 border-ink bg-yellow px-4 pt-4 pb-3 select-none sm:rounded-t-[4px] sm:pt-3"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
			role="presentation"
		>
			<span class="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/40 sm:hidden"></span>
			<h2 class="nb-title text-xl">{title}</h2>
			<button class="nb-press bg-bg0h px-2.5 py-1 font-bold" onclick={close} aria-label="Close">✕</button>
		</div>
		<div class="overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+var(--safe-bottom))]">
			{@render children()}
		</div>
	</div>
{/if}
