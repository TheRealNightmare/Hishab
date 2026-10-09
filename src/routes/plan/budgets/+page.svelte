<script lang="ts">
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { changed, refs, toast } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatMonth, monthKey, today } from '#lib/domain/dates';
	import { isBookkeeping } from '#lib/meta';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import MoneyInput from '#lib/ui/MoneyInput.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Button from '#lib/ui/Button.svelte';
	import type { Budget, Dashboard } from '#lib/types';

	const month = monthKey(today());
	const budgets = loader(() => api.get<Budget[]>('budgets'));
	const dash = loader(() => api.get<Dashboard>(`dashboard?month=${month}`));

	const expenseCats = $derived(refs.categories.filter((c) => c.kind === 'expense' && !c.archived && !c.parent_id && !isBookkeeping(c)));
	const spentBy = $derived(new Map((dash.value?.by_category ?? []).map((c) => [c.category_id, c.total])));

	// Editable draft: category_id → paisa
	let draft = $state<Record<string, number | null>>({});
	$effect(() => {
		const next: Record<string, number | null> = {};
		for (const b of budgets.value ?? []) if (!b.month) next[b.category_id] = b.amount;
		draft = next;
	});

	const totalBudget = $derived(Object.values(draft).reduce<number>((s, v) => s + (v ?? 0), 0));
	const totalSpent = $derived(expenseCats.filter((c) => draft[c.id]).reduce((s, c) => s + (spentBy.get(c.id) ?? 0), 0));
	let saving = $state(false);

	async function save() {
		saving = true;
		try {
			const existing = new Map((budgets.value ?? []).filter((b) => !b.month).map((b) => [b.category_id, b]));
			for (const c of expenseCats) {
				const v = draft[c.id];
				const b = existing.get(c.id);
				if (v && v > 0) {
					if (!b) await api.post('budgets', { category_id: c.id, amount: v });
					else if (b.amount !== v) await api.put(`budgets/${b.id}`, { amount: v });
				} else if (b) await api.del(`budgets/${b.id}`);
			}
			toast('Budgets saved');
			await changed();
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Budgets · Hishab</title></svelte:head>

<PageHeader title="Budgets" back="/plan" sub="Monthly limits. Progress shown for {formatMonth(month)}">
	{#snippet actions()}<Button variant="primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>{/snippet}
</PageHeader>

<div class="nb-card mb-5 bg-purple p-4 text-bg0h">
	<div class="flex items-baseline justify-between">
		<span class="text-xs font-bold tracking-wider uppercase">Budgeted this month</span>
		<span class="money text-2xl font-extrabold">{formatBDT(totalSpent)} / {formatBDT(totalBudget)}</span>
	</div>
	{#if totalBudget}<div class="mt-2"><Progress value={totalSpent} max={totalBudget} /></div>{/if}
</div>

<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
	{#each expenseCats as c (c.id)}
		{@const spent = spentBy.get(c.id) ?? 0}
		{@const limit = draft[c.id] ?? 0}
		<div class="grid grid-cols-[1fr_9rem] items-center gap-3 px-4 py-3">
			<div class="min-w-0">
				<div class="flex justify-between text-sm font-bold">
					<span class="truncate">{c.icon} {c.name}</span>
					<span class="money {limit && spent > limit ? 'text-red-d' : 'text-muted'}">{formatBDT(spent)}</span>
				</div>
				{#if limit}<div class="mt-1"><Progress value={spent} max={limit} /></div>{/if}
			</div>
			<MoneyInput bind:value={draft[c.id]} placeholder="No limit" />
		</div>
	{/each}
</div>
