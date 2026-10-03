<script lang="ts">
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { openQuickAdd } from '#lib/stores.svelte';
	import { formatBDT, formatCompact } from '#lib/domain/money';
	import { formatDate, formatMonth, monthKey, relativeDays, today, addMonths } from '#lib/domain/dates';
	import { typeMeta } from '#lib/meta';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Chart from '#lib/ui/Chart.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import TxnRow from '#lib/ui/TxnRow.svelte';
	import type { Dashboard, Due } from '#lib/types';

	let month = $state(monthKey(today()));
	const dash = loader(() => api.get<Dashboard>(`dashboard?month=${month}`));
	const d = $derived(dash.value);

	const dueIcon: Record<Due['kind'], string> = { emi: '🏦', card: '💳', semester: '🎓', dps: '🐖' };
	const dueBg: Record<Due['kind'], string> = { emi: 'var(--color-orange)', card: 'var(--color-red)', semester: 'var(--color-blue)', dps: 'var(--color-aqua)' };

	function payCard(x: Due) {
		openQuickAdd({ type: 'transfer', to_account_id: x.ref_id, amount: x.amount, title: 'Pay card bill' });
	}

	const daysInMonth = $derived(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate());
	const dailyConfig = $derived.by(() => {
		const map = new Map(d?.daily.map((x) => [x.date, x.total]) ?? []);
		const labels = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
		return {
			type: 'bar' as const,
			data: {
				labels: labels.map((l) => Number(l.slice(8))),
				datasets: [
					{
						data: labels.map((l) => (map.get(l) ?? 0) / 100),
						backgroundColor: labels.map((l) => (l === today() ? '#d65d0e' : '#d79921')),
						borderColor: '#282828',
						borderWidth: 2,
						borderSkipped: false as const,
						borderRadius: 2
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { raw: unknown }) => formatBDT(Number(c.raw) * 100) } } },
				scales: {
					x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 6 } },
					y: { beginAtZero: true, ticks: { callback: (v: string | number) => formatCompact(Number(v) * 100) } }
				}
			}
		};
	});

	const catConfig = $derived.by(() => {
		const rows = d?.by_category.slice(0, 8) ?? [];
		return {
			type: 'doughnut' as const,
			data: {
				labels: rows.map((r) => `${r.icon ?? ''} ${r.name}`),
				datasets: [{ data: rows.map((r) => r.total / 100), backgroundColor: rows.map((r) => r.color ?? '#928374'), borderColor: '#282828', borderWidth: 2 }]
			},
			options: {
				maintainAspectRatio: false,
				cutout: '58%',
				plugins: {
					legend: { position: 'right' as const, labels: { boxWidth: 12, boxHeight: 12 } },
					tooltip: { callbacks: { label: (c: { raw: unknown }) => formatBDT(Number(c.raw) * 100) } }
				}
			}
		};
	});
</script>

<svelte:head><title>Hishab</title></svelte:head>

{#if !d}
	<div class="h-40 animate-pulse nb-flat"></div>
{:else}
	{#if !d.onboarded && d.accounts.length === 0}
		<section class="nb-card mb-6 bg-yellow p-5">
			<h2 class="nb-title text-2xl">Welcome to Hishab 👋</h2>
			<p class="mt-2 text-sm">Set up your accounts, cards and loans in a couple of minutes. Enter today's balances and start tracking from now.</p>
			<div class="mt-4"><Button variant="default" href="/more/setup">Start setup →</Button></div>
		</section>
	{/if}

	<!-- Header: month switcher -->
	<header class="mb-4 flex items-center justify-between gap-2">
		<div>
			<div class="text-xs font-bold tracking-widest uppercase text-muted">Overview</div>
			<h1 class="nb-title text-3xl sm:text-4xl">{formatMonth(month)}</h1>
		</div>
		<div class="flex gap-2">
			<Button size="sm" onclick={() => (month = addMonths(`${month}-01`, -1).slice(0, 7))} aria-label="Previous month">←</Button>
			<Button size="sm" disabled={month >= monthKey(today())} onclick={() => (month = addMonths(`${month}-01`, 1).slice(0, 7))} aria-label="Next month">→</Button>
		</div>
	</header>

	<!-- Key numbers -->
	<section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="col-span-2">
			<StatTile label="Net worth" bg="var(--color-aqua)">
				<span class="money text-3xl font-extrabold sm:text-4xl">{formatBDT(d.net_worth)}</span>
				{#snippet sub()}
					Assets {formatCompact(d.assets)} · Debts {formatCompact(d.liabilities)}
				{/snippet}
			</StatTile>
		</div>
		<StatTile label="Income" bg="var(--color-green)"><span class="money font-extrabold">{formatBDT(d.income)}</span></StatTile>
		<StatTile label="Spent" bg="var(--color-red)">
			<span class="money font-extrabold text-bg0h">{formatBDT(d.expense)}</span>
			{#snippet sub()}<span class="text-bg0h">Left {formatBDT(d.income - d.expense)}</span>{/snippet}
		</StatTile>
	</section>

	<!-- Accounts strip -->
	<section class="mt-6">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="nb-title text-xl">Accounts</h2>
			<a href="/accounts" class="text-xs font-bold tracking-wider uppercase underline">All →</a>
		</div>
		{#if d.accounts.length === 0}
			<Empty icon="💼" title="No accounts yet"><a class="underline" href="/accounts?new=1">Add cash, bKash, bank or card</a></Empty>
		{:else}
			<div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:px-0">
				{#each d.accounts as a (a.id)}
					{@const m = typeMeta(a.type)}
					<a href="/accounts/{a.id}" class="nb-press min-w-40 shrink-0 snap-start p-3" style="background:{a.color ?? m.color}">
						<div class="flex items-center justify-between text-xs font-bold uppercase">
							<span>{m.icon} {a.type === 'wallet' ? (a.provider ?? 'Wallet') : m.label}</span>
						</div>
						<div class="mt-1 truncate font-bold">{a.name}</div>
						<div class="money mt-1 text-lg font-extrabold">{formatBDT(a.balance ?? 0)}</div>
						{#if a.type === 'card' && a.credit_limit}
							<div class="text-[0.68rem] font-bold">Avail {formatCompact(a.credit_limit + (a.balance ?? 0))}</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Upcoming dues -->
		<section>
			<h2 class="nb-title mb-2 text-xl">Upcoming dues</h2>
			{#if d.dues.length === 0}
				<Empty icon="✅" title="Nothing due soon" />
			{:else}
				<ul class="nb-card divide-y-2 divide-ink overflow-hidden">
					{#each d.dues as x (x.kind + x.ref_id + x.date)}
						<li class="flex items-center gap-3 px-3 py-2.5 {x.overdue ? 'bg-red/15' : ''}">
							<span class="flex size-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-ink text-lg" style="background:{dueBg[x.kind]}"
								>{dueIcon[x.kind]}</span
							>
							<a href={x.href} class="min-w-0 flex-1">
								<span class="block truncate font-bold">{x.title}</span>
								<span class="block truncate text-xs text-muted">{x.subtitle}</span>
							</a>
							<div class="text-right">
								<Amount value={x.amount} />
								<div class="text-[0.7rem] font-bold uppercase {x.overdue ? 'text-red-d' : 'text-muted'}">
									{x.overdue ? 'Overdue · ' : ''}{formatDate(x.date)} · {relativeDays(x.date)}
								</div>
							</div>
							{#if x.kind === 'card'}
								<Button size="sm" variant="primary" onclick={() => payCard(x)}>Pay</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Recent -->
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="nb-title text-xl">Recent</h2>
				<a href="/activity" class="text-xs font-bold tracking-wider uppercase underline">All →</a>
			</div>
			{#if d.recent.length === 0}
				<Empty icon="🧾" title="No transactions yet">Tap ＋ to add your first one.</Empty>
			{:else}
				<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
					{#each d.recent as t (t.id)}<TxnRow {t} showDate />{/each}
				</div>
			{/if}
		</section>

		<!-- Daily spending -->
		<section class="nb-card p-4">
			<h2 class="nb-title mb-3 text-xl">Daily spending</h2>
			{#if d.daily.length}
				{#key month + d.daily.length + d.expense}<Chart config={dailyConfig} height={200} />{/key}
			{:else}
				<p class="text-sm text-muted">No spending recorded this month.</p>
			{/if}
		</section>

		<!-- Category breakdown -->
		<section class="nb-card p-4">
			<h2 class="nb-title mb-3 text-xl">Where it went</h2>
			{#if d.by_category.length}
				{#key month + d.expense}<Chart config={catConfig} height={220} />{/key}
			{:else}
				<p class="text-sm text-muted">Nothing yet.</p>
			{/if}
		</section>

		<!-- Budgets -->
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="nb-title text-xl">Budgets</h2>
				<a href="/plan/budgets" class="text-xs font-bold tracking-wider uppercase underline">Edit →</a>
			</div>
			{#if d.budgets.length === 0}
				<Empty icon="◔" title="No budgets"><a class="underline" href="/plan/budgets">Set monthly limits per category</a></Empty>
			{:else}
				<div class="nb-card space-y-3 p-4">
					{#each d.budgets as b (b.category_id)}
						<div>
							<div class="mb-1 flex justify-between text-sm font-bold">
								<span>{b.icon} {b.name}</span>
								<span class="money {b.spent > b.limit ? 'text-red-d' : ''}">{formatCompact(b.spent)} / {formatCompact(b.limit)}</span>
							</div>
							<Progress value={b.spent} max={b.limit} />
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Goals -->
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="nb-title text-xl">Savings goals</h2>
				<a href="/plan/savings" class="text-xs font-bold tracking-wider uppercase underline">All →</a>
			</div>
			{#if d.goals.length === 0}
				<Empty icon="🎯" title="No goals yet"><a class="underline" href="/plan/savings">Save for a laptop, trip, emergency fund…</a></Empty>
			{:else}
				<div class="nb-card space-y-3 p-4">
					{#each d.goals as g (g.id)}
						<div>
							<div class="mb-1 flex justify-between text-sm font-bold">
								<span>{g.name}</span>
								<span class="money">{formatCompact(g.saved ?? 0)} / {formatCompact(g.target)}</span>
							</div>
							<Progress value={g.saved ?? 0} max={g.target} color={g.color ?? 'var(--color-aqua)'} warn={false} />
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}
