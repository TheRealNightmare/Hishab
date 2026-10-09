<script lang="ts">
	import { fly } from 'svelte/transition';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { openQuickAdd } from '#lib/stores.svelte';
	import { formatBDT, formatCompact } from '#lib/domain/money';
	import { formatDate, formatMonth, monthKey, relativeDays, today, addMonths } from '#lib/domain/dates';
	import { DUE_META, typeMeta } from '#lib/meta';
	import { ms } from '#lib/motion';
	import Amount from '#lib/ui/Amount.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Chart from '#lib/ui/Chart.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import ErrorState from '#lib/ui/ErrorState.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Skeleton from '#lib/ui/Skeleton.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import TxnRow from '#lib/ui/TxnRow.svelte';
	import type { Dashboard, Due } from '#lib/types';

	let month = $state(monthKey(today()));
	const dash = loader(() => api.get<Dashboard>(`dashboard?month=${month}`));
	const d = $derived(dash.value);

	function payCard(x: Due) {
		openQuickAdd({ type: 'transfer', to_account_id: x.ref_id, amount: x.amount, title: 'Pay card bill' });
	}

	// Net worth counts up to its value on first load, then glides between months.
	const netWorth = new Tween(0, { duration: 700, easing: cubicOut });
	$effect(() => {
		if (d) netWorth.set(d.net_worth, { duration: ms(700) });
	});

	// Phones show the charts/budgets/goals one at a time in tabs; wide screens show them all.
	let innerWidth = $state(0);
	const wide = $derived(innerWidth >= 1024);
	let tab = $state<'daily' | 'cats' | 'budgets' | 'goals'>('daily');

	let dailyWidth = $state(0);
	let catWidth = $state(0);
	const dailyTicks = $derived(dailyWidth && dailyWidth < 480 ? 8 : 31);
	const legendPos = $derived(catWidth && catWidth < 480 ? ('bottom' as const) : ('right' as const));

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
					x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 6, maxTicksLimit: dailyTicks } },
					y: { beginAtZero: true, ticks: { maxTicksLimit: 5, callback: (v: string | number) => formatCompact(Number(v) * 100) } }
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
					legend: { position: legendPos, labels: { boxWidth: 12, boxHeight: 12, padding: 8 } },
					tooltip: { callbacks: { label: (c: { raw: unknown }) => formatBDT(Number(c.raw) * 100) } }
				}
			}
		};
	});

	/** Plain-language observations about the month, most useful first. */
	const insights = $derived.by(() => {
		const i = d?.insights;
		if (!d || !i || (i.spent_to_date === 0 && i.prev_same_span === 0)) return [];
		const out: { icon: string; text: string; tone?: 'good' | 'bad' }[] = [];
		const prevName = formatMonth(addMonths(`${month}-01`, -1).slice(0, 7)).split(' ')[0];
		if (i.pace_pct !== null && Math.abs(i.pace_pct) >= 3) {
			const up = i.pace_pct > 0;
			out.push({
				icon: up ? '📈' : '📉',
				text: i.is_current
					? `Spending ${Math.abs(i.pace_pct)}% ${up ? 'faster' : 'slower'} than this time in ${prevName}`
					: `Spent ${Math.abs(i.pace_pct)}% ${up ? 'more' : 'less'} than ${prevName}`,
				tone: up ? 'bad' : 'good'
			});
		}
		if (i.projected !== null && i.elapsed_days >= 3) {
			const over = d.income > 0 && i.projected > d.income;
			out.push({ icon: '🔮', text: `On track for ${formatCompact(i.projected)} by month-end${over ? `, more than the ${formatCompact(d.income)} you earned` : ''}`, tone: over ? 'bad' : undefined });
		}
		const top = i.deltas[0];
		if (top && Math.abs(top.delta) >= 10000) {
			out.push({
				icon: top.icon ?? '•',
				text: `${top.name} ${top.delta > 0 ? '+' : '−'}${formatCompact(Math.abs(top.delta))} vs ${i.is_current ? 'same days last month' : prevName}`,
				tone: top.delta > 0 ? 'bad' : 'good'
			});
		}
		if (i.savings_rate !== null) {
			out.push({ icon: '🐖', text: i.savings_rate >= 0 ? `Kept ${i.savings_rate}% of this month's income` : `Spent ${-i.savings_rate}% more than you earned`, tone: i.savings_rate >= 0 ? 'good' : 'bad' });
		}
		if (i.no_spend_days > 0 && i.spent_to_date > 0) {
			out.push({ icon: '🎉', text: `${i.no_spend_days} no-spend day${i.no_spend_days === 1 ? '' : 's'} · avg ${formatCompact(i.avg_daily)}/day`, tone: 'good' });
		}
		return out.slice(0, 4);
	});
</script>

<svelte:head><title>Hishab</title></svelte:head>
<svelte:window bind:innerWidth />

{#snippet daily()}
	<section class="nb-card p-4">
		<h2 class="nb-title mb-3 text-xl">Daily spending</h2>
		{#if d?.daily.length}
			<div bind:clientWidth={dailyWidth}>
				{#key month + d.daily.length + d.expense + dailyTicks}<Chart config={dailyConfig} height={200} />{/key}
			</div>
		{:else}
			<p class="text-sm text-muted">No spending recorded this month.</p>
		{/if}
	</section>
{/snippet}

{#snippet categories()}
	<section class="nb-card p-4">
		<h2 class="nb-title mb-3 text-xl">Where it went</h2>
		{#if d?.by_category.length}
			<div bind:clientWidth={catWidth}>
				{#key month + d.expense + legendPos}<Chart config={catConfig} height={legendPos === 'bottom' ? 300 : 220} />{/key}
			</div>
		{:else}
			<p class="text-sm text-muted">Nothing yet.</p>
		{/if}
	</section>
{/snippet}

{#snippet budgets()}
	<section>
		<div class="mb-2 flex items-center justify-between">
			<h2 class="nb-title text-xl">Budgets</h2>
			<a href="/plan/budgets" class="py-1 text-xs font-bold tracking-wider uppercase underline">Edit →</a>
		</div>
		{#if !d?.budgets.length}
			<Empty icon="◔" title="No budgets"><a class="underline" href="/plan/budgets">Set monthly limits per category</a></Empty>
		{:else}
			<div class="nb-card space-y-3 p-4">
				{#each d.budgets as b (b.category_id)}
					<div>
						<div class="mb-1 flex justify-between gap-2 text-sm font-bold">
							<span class="min-w-0 truncate">{b.icon} {b.name}</span>
							<span class="money shrink-0 {b.spent > b.limit ? 'text-red-d' : ''}">{formatCompact(b.spent)} / {formatCompact(b.limit)}</span>
						</div>
						<Progress value={b.spent} max={b.limit} />
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/snippet}

{#snippet goals()}
	<section>
		<div class="mb-2 flex items-center justify-between">
			<h2 class="nb-title text-xl">Savings goals</h2>
			<a href="/plan/savings" class="py-1 text-xs font-bold tracking-wider uppercase underline">All →</a>
		</div>
		{#if !d?.goals.length}
			<Empty icon="🎯" title="No goals yet"><a class="underline" href="/plan/savings">Save for a laptop, trip, emergency fund…</a></Empty>
		{:else}
			<div class="nb-card space-y-3 p-4">
				{#each d.goals as g (g.id)}
					<div>
						<div class="mb-1 flex justify-between gap-2 text-sm font-bold">
							<span class="min-w-0 truncate">{g.name}</span>
							<span class="money shrink-0">{formatCompact(g.saved ?? 0)} / {formatCompact(g.target)}</span>
						</div>
						<Progress value={g.saved ?? 0} max={g.target} color={g.color ?? 'var(--color-aqua)'} warn={false} />
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/snippet}

{#if dash.error && !d}
	<ErrorState onretry={dash.reload} />
{:else if !d}
	<Skeleton rows={5} />
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
		<div class="min-w-0">
			<div class="text-xs font-bold tracking-widest uppercase text-muted">Overview</div>
			<h1 class="nb-title truncate text-3xl sm:text-4xl">{formatMonth(month)}</h1>
		</div>
		<div class="flex shrink-0 gap-2">
			<Button size="sm" class="min-h-9 min-w-9" onclick={() => (month = addMonths(`${month}-01`, -1).slice(0, 7))} aria-label="Previous month">←</Button>
			<Button size="sm" class="min-h-9 min-w-9" disabled={month >= monthKey(today())} onclick={() => (month = addMonths(`${month}-01`, 1).slice(0, 7))} aria-label="Next month"
				>→</Button
			>
		</div>
	</header>

	<!-- Key numbers -->
	<section class="grid grid-cols-2 gap-3 sm:grid-cols-4" in:fly={{ y: 12, duration: ms(250) }}>
		<div class="col-span-2">
			<StatTile label="Net worth" bg="var(--color-aqua)">
				<span class="money block truncate text-3xl font-extrabold sm:text-4xl">{formatBDT(Math.round(netWorth.current))}</span>
				{#snippet sub()}
					Assets {formatCompact(d.assets)} · Debts {formatCompact(d.liabilities)}
					{#if d.debts.owed_to_me || d.debts.i_owe}
						<a href="/plan/people" class="mt-0.5 block font-bold underline decoration-dotted">
							🤝 {[d.debts.owed_to_me && `Owed to you ${formatCompact(d.debts.owed_to_me)}`, d.debts.i_owe && `You owe ${formatCompact(d.debts.i_owe)}`]
								.filter(Boolean)
								.join(' · ')}
						</a>
					{/if}
				{/snippet}
			</StatTile>
		</div>
		<StatTile label="Income" bg="var(--color-green)"><span class="money block truncate font-extrabold">{formatBDT(d.income)}</span></StatTile>
		<StatTile label="Spent" bg="var(--color-red)">
			<span class="money block truncate font-extrabold text-bg0h">{formatBDT(d.expense)}</span>
			{#snippet sub()}<span class="text-bg0h">Left {formatBDT(d.income - d.expense)}</span>{/snippet}
		</StatTile>
	</section>

	<!-- Insights -->
	{#if insights.length}
		<section class="nb-card mt-4 overflow-hidden" in:fly={{ y: 12, duration: ms(250), delay: ms(60) }}>
			<div class="flex items-center justify-between border-b-2 border-ink bg-yellow px-3 py-1.5">
				<h2 class="text-xs font-extrabold tracking-widest uppercase">💡 Insights</h2>
				<a href="/reports" class="py-0.5 text-[0.7rem] font-bold tracking-wider uppercase underline">More →</a>
			</div>
			<ul class="divide-y divide-dashed divide-bg3">
				{#each insights as x (x.text)}
					<li class="flex items-start gap-2.5 px-3 py-2 text-sm">
						<span class="w-5 shrink-0 text-center">{x.icon}</span>
						<span class="font-bold {x.tone === 'bad' ? 'text-red-d' : x.tone === 'good' ? 'text-green-d' : ''}">{x.text}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Accounts strip -->
	<section class="mt-6" in:fly={{ y: 12, duration: ms(250), delay: ms(120) }}>
		<div class="mb-2 flex items-center justify-between">
			<h2 class="nb-title text-xl">Accounts</h2>
			<a href="/accounts" class="py-1 text-xs font-bold tracking-wider uppercase underline">All →</a>
		</div>
		{#if d.accounts.length === 0}
			<Empty icon="💼" title="No accounts yet"><a class="underline" href="/accounts?new=1">Add cash, bKash, bank or card</a></Empty>
		{:else}
			<div class="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:px-0">
				{#each d.accounts as a (a.id)}
					{@const m = typeMeta(a.type)}
					<a href="/accounts/{a.id}" class="nb-press w-40 shrink-0 snap-start p-3" style="background:{a.color ?? m.color}">
						<div class="truncate text-xs font-bold uppercase">{m.icon} {a.type === 'wallet' ? (a.provider ?? 'Wallet') : m.label}</div>
						<div class="mt-1 truncate font-bold">{a.name}</div>
						<div class="money mt-1 truncate text-lg font-extrabold">{formatBDT(a.balance ?? 0)}</div>
						{#if a.type === 'card' && a.credit_limit}
							<div class="text-[0.68rem] font-bold">Avail {formatCompact(a.credit_limit + (a.balance ?? 0))}</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2" in:fly={{ y: 12, duration: ms(250), delay: ms(180) }}>
		<!-- Upcoming dues -->
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="nb-title text-xl">Upcoming dues</h2>
				<a href="/plan/calendar" class="py-1 text-xs font-bold tracking-wider uppercase underline">Calendar →</a>
			</div>
			{#if d.dues.length === 0}
				<Empty icon="✅" title="Nothing due soon" />
			{:else}
				<ul class="nb-card divide-y-2 divide-ink overflow-hidden">
					{#each d.dues as x (x.kind + x.ref_id + x.date)}
						<li class="flex items-start gap-3 px-3 py-2.5 {x.overdue ? 'bg-red/15' : ''}">
							<span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-ink text-lg" style="background:{DUE_META[x.kind].bg}"
								>{DUE_META[x.kind].icon}</span
							>
							<a href={x.href} class="min-w-0 flex-1">
								<span class="block truncate font-bold">{x.title}</span>
								<span class="block truncate text-xs text-muted">{x.subtitle}</span>
								<span class="mt-0.5 flex flex-wrap items-center gap-1 text-[0.7rem] font-bold uppercase {x.overdue ? 'text-red-d' : 'text-muted'}">
									{#if x.overdue}<span class="rounded-[3px] border border-red-d bg-red px-1 text-bg0h">Overdue</span>{/if}
									{formatDate(x.date)} · {relativeDays(x.date)}
								</span>
							</a>
							<div class="flex shrink-0 flex-col items-end gap-1.5">
								<Amount value={x.amount} />
								{#if x.kind === 'card'}
									<Button size="sm" variant="primary" onclick={() => payCard(x)}>Pay</Button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Recent -->
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="nb-title text-xl">Recent</h2>
				<a href="/activity" class="py-1 text-xs font-bold tracking-wider uppercase underline">All →</a>
			</div>
			{#if d.recent.length === 0}
				<Empty icon="🧾" title="No transactions yet">Tap ＋ to add your first one.</Empty>
			{:else}
				<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
					{#each d.recent as t (t.id)}<TxnRow {t} showDate />{/each}
				</div>
			{/if}
		</section>

		{#if wide}
			{@render daily()}
			{@render categories()}
			{@render budgets()}
			{@render goals()}
		{:else}
			<section class="space-y-3">
				<Segmented
					compact
					options={[
						{ value: 'daily', label: 'Daily' },
						{ value: 'cats', label: 'Category' },
						{ value: 'budgets', label: 'Budgets' },
						{ value: 'goals', label: 'Goals' }
					]}
					bind:value={tab}
				/>
				{#if tab === 'daily'}{@render daily()}{:else if tab === 'cats'}{@render categories()}{:else if tab === 'budgets'}{@render budgets()}{:else}{@render goals()}{/if}
			</section>
		{/if}
	</div>
{/if}
