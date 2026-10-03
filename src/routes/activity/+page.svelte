<script lang="ts">
	import { page } from '$app/state';
	import { api, qs } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { refs } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatDate, monthKey, monthRange, today, relativeDays } from '#lib/domain/dates';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TxnRow from '#lib/ui/TxnRow.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import Button from '#lib/ui/Button.svelte';
	import type { Txn, TxnType } from '#lib/types';

	const PAGE = 100;
	let month = $state(page.url.searchParams.get('month') ?? monthKey(today()));
	let account = $state(page.url.searchParams.get('account') ?? '');
	let categoryId = $state(page.url.searchParams.get('category') ?? '');
	let type = $state<TxnType | ''>('');
	let q = $state('');
	let tag = $state(page.url.searchParams.get('tag') ?? '');
	let limit = $state(PAGE);
	let debounced = $state('');

	$effect(() => {
		const v = q;
		const id = setTimeout(() => (debounced = v), 250);
		return () => clearTimeout(id);
	});

	const range = $derived(month === 'all' ? { from: '', to: '' } : monthRange(month));
	const list = loader(() =>
		api.get<Txn[]>(`transactions${qs({ ...range, account, category: categoryId, type, q: debounced, tag, limit })}`)
	);

	const groups = $derived.by(() => {
		const out: { date: string; items: Txn[]; net: number }[] = [];
		for (const t of list.value ?? []) {
			let g = out.at(-1);
			if (!g || g.date !== t.date) out.push((g = { date: t.date, items: [], net: 0 }));
			g.items.push(t);
			if (t.type === 'income') g.net += t.amount;
			if (t.type === 'expense') g.net -= t.amount;
		}
		return out;
	});

	const months = $derived.by(() => {
		const out: string[] = [];
		const d = new Date();
		for (let i = 0; i < 18; i++) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1).toISOString().slice(0, 10)));
		return [...new Set(out)];
	});
	const activeFilters = $derived([account, categoryId, type, tag].filter(Boolean).length);
	let showFilters = $state(false);

	function clear() {
		account = categoryId = tag = q = '';
		type = '';
	}
</script>

<svelte:head><title>Activity · Hishab</title></svelte:head>

<PageHeader title="Activity" />

<div class="mb-4 space-y-3">
	<div class="flex gap-2">
		<input class="nb-input" type="search" placeholder="Search notes, tags, categories…" bind:value={q} />
		<Button onclick={() => (showFilters = !showFilters)} variant={activeFilters ? 'primary' : 'default'}>
			Filter{activeFilters ? ` · ${activeFilters}` : ''}
		</Button>
	</div>
	<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
		<button class="nb-chip shrink-0 {month === 'all' ? 'bg-yellow' : ''}" onclick={() => (month = 'all')}>All time</button>
		{#each months as m (m)}
			<button class="nb-chip shrink-0 {month === m ? 'bg-yellow' : 'bg-bg0h'}" onclick={() => (month = m)}>
				{new Date(`${m}-01T00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
			</button>
		{/each}
	</div>
	{#if showFilters}
		<div class="nb-card grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
			<select class="nb-input" bind:value={type}>
				<option value="">All types</option>
				<option value="expense">Expense</option>
				<option value="income">Income</option>
				<option value="transfer">Transfer</option>
			</select>
			<select class="nb-input" bind:value={account}>
				<option value="">All accounts</option>
				{#each refs.accounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
			</select>
			<select class="nb-input" bind:value={categoryId}>
				<option value="">All categories</option>
				{#each refs.categories.filter((c) => !c.parent_id) as c (c.id)}<option value={c.id}>{c.icon} {c.name}</option>{/each}
			</select>
			<input class="nb-input" placeholder="#tag" bind:value={tag} />
			<div class="col-span-2 sm:col-span-4"><Button size="sm" onclick={clear}>Clear filters</Button></div>
		</div>
	{/if}
</div>

{#if list.value && groups.length === 0}
	<Empty icon="🔍" title="No transactions">Try another month or clear filters.</Empty>
{:else}
	<div class="space-y-4" class:opacity-60={list.loading}>
		{#each groups as g (g.date)}
			<section>
				<div class="mb-1 flex items-baseline justify-between px-1">
					<h2 class="text-sm font-extrabold uppercase">
						{formatDate(g.date, 'long')} <span class="font-bold text-muted normal-case">· {relativeDays(g.date)}</span>
					</h2>
					<span class="money text-xs font-bold {g.net < 0 ? 'text-red-d' : 'text-green-d'}">{formatBDT(g.net, { sign: true })}</span>
				</div>
				<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
					{#each g.items as t (t.id)}<TxnRow {t} />{/each}
				</div>
			</section>
		{/each}
	</div>
	{#if (list.value?.length ?? 0) >= limit}
		<div class="mt-4 text-center"><Button onclick={() => (limit += PAGE)}>Load more</Button></div>
	{/if}
{/if}
