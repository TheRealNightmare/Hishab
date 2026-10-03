<script lang="ts">
	import { refs } from '#lib/stores.svelte';
	import { typeMeta, ACCOUNT_TYPES } from '#lib/meta';
	import type { AccountType } from '#lib/types';

	let {
		value = $bindable(),
		exclude,
		types,
		placeholder = 'Choose account',
		id
	}: { value: string | null | undefined; exclude?: string | null; types?: AccountType[]; placeholder?: string; id?: string } = $props();

	const groups = $derived(
		ACCOUNT_TYPES.filter((t) => !types || types.includes(t.value))
			.map((t) => ({ ...t, accounts: refs.accounts.filter((a) => a.type === t.value && !a.archived && a.id !== exclude) }))
			.filter((g) => g.accounts.length)
	);
</script>

<select class="nb-input" bind:value {id}>
	<option value={null} disabled selected={!value}>{placeholder}</option>
	{#each groups as g (g.value)}
		<optgroup label="{typeMeta(g.value).icon} {g.label}">
			{#each g.accounts as a (a.id)}
				<option value={a.id}>{a.name}</option>
			{/each}
		</optgroup>
	{/each}
</select>
