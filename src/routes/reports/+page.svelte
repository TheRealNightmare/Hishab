<script lang="ts">
	import { api, qs } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { formatBDT, formatCompact } from '#lib/domain/money';
	import { addMonths, formatMonth, monthKey, monthRange, today } from '#lib/domain/dates';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Chart from '#lib/ui/Chart.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import Field from '#lib/ui/Field.svelte';

	interface Report {
		from: string;
		to: string;
		monthly: { month: string; income: number; expense: number }[];
		by_category: { category_id: string; name: string; icon: string | null; color: string | null; kind: string; total: number; count: number }[];
		by_account: { account_id: string; name: string; expense: number }[];
		semesters: { id: string; name: string; start_date: string; end_date: string; spent: number; fees_total: number; fees_paid: number }[];
	}

	const presets = [
		{ label: 'This month', from: () => monthRange(monthKey(today())).from, to: () => today() },
		{ label: '3 months', from: () => `${addMonths(today(), -2).slice(0, 7)}-01`, to: () => today() },
		{ label: '6 months', from: () => `${addMonths(today(), -5).slice(0, 7)}-01`, to: () => today() },
		{ label: 'This year', from: () => `${today().slice(0, 4)}-01-01`, to: () => today() },
		{ label: '12 months', from: () => `${addMonths(today(), -11).slice(0, 7)}-01`, to: () => today() }
	];
	let from = $state(presets[2].from());
	let to = $state(today());

	const rep = loader(() => api.get<Report>(`reports${qs({ from, to })}`));
	const r = $derived(rep.value);
	const income = $derived(r?.monthly.reduce((s, m) => s + m.income, 0) ?? 0);
	const expense = $derived(r?.monthly.reduce((s, m) => s + m.expense, 0) ?? 0);
	const months = $derived(Math.max(1, r?.monthly.length ?? 1));
	const expenseCats = $derived(r?.by_category.filter((c) => c.kind === 'expense') ?? []);
	const incomeCats = $derived(r?.by_category.filter((c) => c.kind === 'income') ?? []);

	const monthlyConfig = $derived({
		type: 'bar' as const,
		data: {
			labels: r?.monthly.map((m) => formatMonth(m.month).replace(/ (\d{2})(\d{2})$/, " '$2")) ?? [],
			datasets: [
				{ label: 'Income', data: r?.monthly.map((m) => m.income / 100) ?? [], backgroundColor: '#98971a', borderColor: '#282828', borderWidth: 2 },
				{ label: 'Expense', data: r?.monthly.map((m) => m.expense / 100) ?? [], backgroundColor: '#cc241d', borderColor: '#282828', borderWidth: 2 }
			]
		},
		options: {
			maintainAspectRatio: false,
			plugins: { tooltip: { callbacks: { label: (c: { dataset: { label?: string }; raw: unknown }) => `${c.dataset.label}: ${formatBDT(Number(c.raw) * 100)}` } } },
			scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v: string | number) => formatCompact(Number(v) * 100) } } }
		}
	});
</script>

<svelte:head><title>Reports · Hishab</title></svelte:head>

<PageHeader title="Reports" />

<div class="mb-5 space-y-3">
	<div class="flex flex-wrap gap-2">
		{#each presets as p (p.label)}
			<button class="nb-chip {from === p.from() && to === p.to() ? 'bg-yellow' : 'bg-bg0h'}" onclick={() => ((from = p.from()), (to = p.to()))}>{p.label}</button>
		{/each}
	</div>
	<div class="grid max-w-md grid-cols-2 gap-3">
		<Field label="From"><input class="nb-input" type="date" bind:value={from} /></Field>
		<Field label="To"><input class="nb-input" type="date" bind:value={to} /></Field>
	</div>
</div>

{#if r}
	<section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<StatTile label="Income" bg="var(--color-green)"><span class="money font-extrabold">{formatBDT(income)}</span></StatTile>
		<StatTile label="Expense" bg="var(--color-red)"><span class="money font-extrabold text-bg0h">{formatBDT(expense)}</span></StatTile>
		<StatTile label="Saved" bg="var(--color-aqua)">
			<span class="money font-extrabold">{formatBDT(income - expense)}</span>
			{#snippet sub()}{income ? Math.round(((income - expense) / income) * 100) : 0}% of income{/snippet}
		</StatTile>
		<StatTile label="Avg spend / month"><span class="money font-extrabold">{formatBDT(Math.round(expense / months))}</span></StatTile>
	</section>

	<section class="nb-card mt-6 p-4">
		<h2 class="nb-title mb-3 text-xl">Income vs expense</h2>
		{#key from + to + r.monthly.length}<Chart config={monthlyConfig} height={240} />{/key}
	</section>

	<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<section>
			<h2 class="nb-title mb-2 text-xl">Spending by category</h2>
			<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
				{#each expenseCats as c (c.category_id)}
					<a href="/activity?category={c.category_id}&month=all" class="block px-4 py-2.5 hover:bg-bg1">
						<div class="flex justify-between text-sm font-bold">
							<span>{c.icon} {c.name} <span class="font-normal text-muted">· {c.count}</span></span>
							<span class="money">{formatBDT(c.total)} <span class="text-muted">{expense ? Math.round((c.total / expense) * 100) : 0}%</span></span>
						</div>
						<div class="mt-1 h-2 rounded-full border border-ink bg-bg1">
							<div class="h-full rounded-full" style="width:{expense ? (c.total / expense) * 100 : 0}%;background:{c.color ?? '#928374'}"></div>
						</div>
					</a>
				{:else}
					<p class="p-4 text-sm text-muted">No spending in this range.</p>
				{/each}
			</div>
		</section>

		<section class="space-y-6">
			<div>
				<h2 class="nb-title mb-2 text-xl">Income sources</h2>
				<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
					{#each incomeCats as c (c.category_id)}
						<div class="flex justify-between px-4 py-2.5 text-sm font-bold">
							<span>{c.icon} {c.name}</span><span class="money text-green-d">{formatBDT(c.total)}</span>
						</div>
					{:else}
						<p class="p-4 text-sm text-muted">No income in this range.</p>
					{/each}
				</div>
			</div>
			<div>
				<h2 class="nb-title mb-2 text-xl">Spent from</h2>
				<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
					{#each r.by_account as a (a.account_id)}
						<div class="flex justify-between px-4 py-2.5 text-sm font-bold"><span>{a.name}</span><span class="money">{formatBDT(a.expense)}</span></div>
					{/each}
				</div>
			</div>
		</section>
	</div>

	{#if r.semesters.length}
		<section class="mt-6">
			<h2 class="nb-title mb-2 text-xl">🎓 Cost per semester</h2>
			<div class="nb-card overflow-x-auto">
				<table class="nb-table">
					<thead><tr><th>Semester</th><th class="text-right">Fees</th><th class="text-right">Fees paid</th><th class="text-right">Total cost</th></tr></thead>
					<tbody>
						{#each r.semesters as s (s.id)}
							<tr>
								<td class="font-bold">{s.name}</td>
								<td class="money text-right">{formatBDT(s.fees_total)}</td>
								<td class="money text-right">{formatBDT(s.fees_paid)}</td>
								<td class="money text-right font-extrabold">{formatBDT(s.spent)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
{/if}
