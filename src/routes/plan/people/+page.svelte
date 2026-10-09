<script lang="ts">
	import { goto } from '$app/navigation';
	import { refs } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { debtTotals } from '#lib/domain/debt';
	import { formatDate } from '#lib/domain/dates';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import PersonForm from '#lib/ui/PersonForm.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import Empty from '#lib/ui/Empty.svelte';

	let adding = $state(false);
	let showArchived = $state(false);
	const list = $derived(refs.people.filter((p) => showArchived || !p.archived));
	const totals = $derived(debtTotals(refs.people.map((p) => p.balance ?? 0)));
</script>

<svelte:head><title>People · Hishab</title></svelte:head>

<PageHeader title="People" back="/plan" sub="Money you lent to or borrowed from friends and family">
	{#snippet actions()}<Button variant="primary" onclick={() => (adding = true)}>＋ Person</Button>{/snippet}
</PageHeader>

<section class="grid grid-cols-2 gap-3">
	<StatTile label="Owed to you" bg="var(--color-green)"><span class="money block truncate font-extrabold">{formatBDT(totals.owed_to_me)}</span></StatTile>
	<StatTile label="You owe" bg="var(--color-red)"><span class="money block truncate font-extrabold text-bg0h">{formatBDT(totals.i_owe)}</span></StatTile>
</section>

<section class="mt-6">
	{#if list.length === 0}
		<Empty icon="🤝" title="Nobody here yet">
			Add a friend, roommate or relative, then record money you lend or borrow. It moves your account balance but doesn't count as spending.
		</Empty>
	{:else}
		<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
			{#each list as p (p.id)}
				{@const b = p.balance ?? 0}
				<a href="/plan/people/{p.id}" class="flex items-center gap-3 px-3 py-3 hover:bg-bg1 {p.archived ? 'opacity-50' : ''}">
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-lg font-extrabold"
						style="background:{b > 0 ? 'var(--color-green)' : b < 0 ? 'var(--color-red)' : 'var(--color-bg1)'}">{p.name.slice(0, 1).toUpperCase()}</span
					>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-bold">{p.name}{p.archived ? ' (archived)' : ''}</span>
						<span class="block truncate text-xs text-muted">{p.last_date ? `Last ${formatDate(p.last_date)}` : 'No entries yet'}{p.count ? ` · ${p.count} entries` : ''}</span>
					</span>
					<span class="shrink-0 text-right">
						<span class="money block font-extrabold {b > 0 ? 'text-green-d' : b < 0 ? 'text-red-d' : 'text-muted'}">{b === 0 ? 'Settled' : formatBDT(Math.abs(b))}</span>
						{#if b !== 0}<span class="block text-[0.68rem] font-bold uppercase text-muted">{b > 0 ? 'owes you' : 'you owe'}</span>{/if}
					</span>
				</a>
			{/each}
		</div>
	{/if}
	{#if refs.people.some((p) => p.archived)}
		<button class="mt-4 py-1 text-xs font-bold tracking-wider uppercase underline" onclick={() => (showArchived = !showArchived)}>
			{showArchived ? 'Hide' : 'Show'} archived
		</button>
	{/if}
</section>

<Sheet bind:open={adding} title="New person">
	{#if adding}
		<PersonForm
			onDone={(id) => {
				adding = false;
				if (id) goto(`/plan/people/${id}`);
			}}
		/>
	{/if}
</Sheet>
