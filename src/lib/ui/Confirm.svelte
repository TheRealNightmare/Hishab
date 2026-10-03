<script lang="ts">
	import { confirmState } from '#lib/stores.svelte';
	import Button from './Button.svelte';
	import { fade, scale } from 'svelte/transition';

	function close(v: boolean) {
		confirmState.open = false;
		confirmState.resolve(v);
	}
</script>

{#if confirmState.open}
	<div class="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4" transition:fade={{ duration: 100 }}>
		<div class="nb-card w-full max-w-sm p-5" transition:scale={{ start: 0.95, duration: 120 }} role="alertdialog" aria-modal="true">
			<h2 class="nb-title text-xl">{confirmState.title}</h2>
			{#if confirmState.body}<p class="mt-2 text-sm text-fg2">{confirmState.body}</p>{/if}
			<div class="mt-5 flex justify-end gap-3">
				<Button onclick={() => close(false)}>Cancel</Button>
				<Button variant={confirmState.danger ? 'danger' : 'primary'} onclick={() => close(true)}>Confirm</Button>
			</div>
		</div>
	</div>
{/if}
