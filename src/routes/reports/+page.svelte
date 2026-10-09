<script lang="ts">
	import { api, qs } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { formatBDT, formatCompact } from '#lib/domain/money';
	import { addMonths, formatDate, formatMonth, monthKey, monthRange, today } from '#lib/domain/dates';
	import { pctChange } from '#lib/domain/insights';
	import { category } from '#lib/stores.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Chart from '#lib/ui/Chart.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Skeleton from '#lib/ui/Skeleton.svelte';
	import ErrorState from '#lib/ui/ErrorState.svelte';
	import type { ReportInsights } from '#lib/types';

	interface Report {
		from: string;
		to: string;
		monthly: { month: string; income: number; expense: number }[];
		by_category: { category_id: string; name: string; icon: string | null; color: string | null; kind: string; total: number; count: number }[];
		by_account: { account_id: string; name: string; expense: number }[];
		semesters: { id: string; name: string; start_date: string; end_date: string; spent: number; fees_total: number; fees_paid: number }[];
		insights: ReportInsights;
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

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const ins = $derived(r?.insights);
	const spendChange = $derived(ins ? pctChange(expense, ins.prev_expense) : null);
	const incomeChange = $derived(ins ? pctChange(income, ins.prev_income) : null);
	const maxDow = $derived(Math.max(1, ...(ins?.weekdays ?? [])));
	const busiest = $derived(ins && ins.weekdays.some((w) => w > 0) ? ins.weekdays.indexOf(Math.max(...ins.weekdays)) : -1);
	const biggestCat = $derived(category(ins?.biggest?.category_id));

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

{#if rep.error && !r}
	<ErrorState onretry={rep.reload} />
{:else if !r}
	<Skeleton rows={4} />
{:else}
	<section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<StatTile label="Income" bg="var(--color-green)">
			<span class="money block truncate font-extrabold">{formatBDT(income)}</span>
			{#snippet sub()}{incomeChange === null ? 'No earlier data' : `${incomeChange > 0 ? '▲' : '▼'} ${Math.abs(incomeChange)}% vs before`}{/snippet}
		</StatTile>
		<StatTile label="Expense" bg="var(--color-red)">
			<span class="money block truncate font-extrabold text-bg0h">{formatBDT(expense)}</span>
			{#snippet sub()}<span class="text-bg0h">{spendChange === null ? 'No earlier data' : `${spendChange > 0 ? '▲' : '▼'} ${Math.abs(spendChange)}% vs before`}</span>{/snippet}
		</StatTile>
		<StatTile label="Saved" bg="var(--color-aqua)">
			<span class="money block truncate font-extrabold">{formatBDT(income - expense)}</span>
			{#snippet sub()}{income ? Math.round(((income - expense) / income) * 100) : 0}% of income{/snippet}
		</StatTile>
		<StatTile label="Avg spend / month">
			<span class="money block truncate font-extrabold">{formatBDT(Math.round(expense / months))}</span>
			{#snippet sub()}{formatBDT(ins?.avg_daily ?? 0)} / day{/snippet}
		</StatTile>
	</section>

	{#if ins}
		<section class="nb-card mt-6 overflow-hidden">
			<div class="flex flex-wrap items-baseline justify-between gap-x-3 border-b-2 border-ink bg-yellow px-4 py-2">
				<h2 class="nb-title text-lg">💡 Insights</h2>
				<span class="text-[0.7rem] font-bold">compared with {formatDate(ins.prev_from)} – {formatDate(ins.prev_to, 'long')}</span>
			</div>
			<div class="grid grid-cols-1 divide-y-2 divide-dashed divide-bg3 md:grid-cols-2 md:divide-x-2 md:divide-y-0">
				<div class="space-y-3 p-4">
					<h3 class="nb-label">Biggest changes by category</h3>
					{#if ins.prev_expense === 0}
						<p class="text-sm text-muted">No spending recorded in the previous period, so there's nothing to compare yet.</p>
					{:else}
					{#each ins.deltas as dlt (dlt.category_id)}
						<a href="/activity?category={dlt.category_id}&month=all" class="flex items-center justify-between gap-2 text-sm font-bold">
							<span class="min-w-0 truncate">{dlt.icon} {dlt.name}</span>
							<span class="money shrink-0 {dlt.delta > 0 ? 'text-red-d' : 'text-green-d'}">
								{dlt.delta > 0 ? '+' : '−'}{formatBDT(Math.abs(dlt.delta))}
								<span class="text-xs font-normal text-muted">{formatCompact(dlt.prev)} → {formatCompact(dlt.total)}</span>
							</span>
						</a>
					{:else}
						<p class="text-sm text-muted">Nothing to compare yet.</p>
					{/each}
					{/if}
					{#if ins.biggest}
						<div class="nb-flat mt-2 bg-bg1 p-3 text-sm">
							<div class="nb-label">Biggest single expense</div>
							<div class="flex items-center justify-between gap-2 font-bold">
								<span class="min-w-0 truncate">{biggestCat?.icon ?? '•'} {ins.biggest.note || biggestCat?.name || 'Expense'}</span>
								<span class="money shrink-0 text-red-d">{formatBDT(ins.biggest.amount)}</span>
							</div>
							<div class="text-xs text-muted">{formatDate(ins.biggest.date, 'long')}{biggestCat && ins.biggest.note ? ` · ${biggestCat.name}` : ''}</div>
						</div>
					{/if}
				</div>
				<div class="p-4">
					<h3 class="nb-label">Spending by weekday</h3>
					<div class="mt-2 flex h-28 items-end gap-1.5">
						{#each ins.weekdays as w, i (i)}
							<div class="flex h-full flex-1 flex-col items-center justify-end gap-1">
								<div
									class="w-full rounded-t-[3px] border-2 border-ink {i === busiest ? 'bg-orange' : 'bg-yellow'}"
									style="height:{Math.max(4, (w / maxDow) * 100)}%"
									title="{WEEKDAYS[i]}: {formatBDT(w)}"
								></div>
								<span class="text-[0.65rem] font-bold uppercase {i === busiest ? 'text-orange-d' : 'text-muted'}">{WEEKDAYS[i].slice(0, 2)}</span>
							</div>
						{/each}
					</div>
					<ul class="mt-3 space-y-1 text-sm font-bold">
						{#if busiest >= 0}<li>📅 You spend most on <span class="text-orange-d">{WEEKDAYS[busiest]}days</span></li>{/if}
						<li>🎉 {ins.no_spend_days} no-spend day{ins.no_spend_days === 1 ? '' : 's'}</li>
					</ul>
				</div>
			</div>
		</section>
	{/if}

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
