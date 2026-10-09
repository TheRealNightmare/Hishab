<script lang="ts">
	import { toasts } from '#lib/stores.svelte';
	import { fly } from 'svelte/transition';
	const bg = { ok: 'var(--color-green)', error: 'var(--color-red)', info: 'var(--color-blue)' };
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+var(--safe-bottom))] z-[60] flex flex-col-reverse items-center gap-2 px-4 lg:bottom-6">
	{#each toasts as t (t.id)}
		<div
			class="nb-card pointer-events-auto px-4 py-2 text-sm font-bold {t.kind === 'ok' ? 'text-ink' : 'text-bg0h'}"
			style="background:{bg[t.kind]}"
			transition:fly={{ y: 20, duration: 180 }}
			role="status"
		>
			{t.msg}
		</div>
	{/each}
</div>
