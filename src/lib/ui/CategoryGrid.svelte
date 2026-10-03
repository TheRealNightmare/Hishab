<script lang="ts">
	import { refs } from '#lib/stores.svelte';

	let { value = $bindable(), kind }: { value: string | null | undefined; kind: 'income' | 'expense' } = $props();
	// System 'loan' categories are booked automatically by loan flows, not picked by hand.
	const cats = $derived(refs.categories.filter((c) => c.kind === kind && !c.archived && c.system !== 'loan'));
</script>

<div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
	{#each cats as c (c.id)}
		<button
			type="button"
			class="flex flex-col items-center gap-0.5 rounded-[4px] border-2 border-ink px-1 py-2 text-center transition-transform {value === c.id
				? 'translate-x-[2px] translate-y-[2px] shadow-none'
				: 'shadow-hard-sm'}"
			style="background:{value === c.id ? (c.color ?? 'var(--color-yellow)') : 'var(--color-bg0h)'}"
			onclick={() => (value = c.id)}
			aria-pressed={value === c.id}
		>
			<span class="text-xl leading-none">{c.icon ?? '•'}</span>
			<span class="w-full truncate text-[0.68rem] font-bold {value === c.id ? 'text-bg0h' : ''}">{c.name}</span>
		</button>
	{/each}
</div>
