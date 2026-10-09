<script lang="ts">
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { openQuickAdd } from '#lib/stores.svelte';
	import { formatBDT, formatCompact } from '#lib/domain/money';
	import { addMonths, formatDate, formatMonth, monthKey, parseISO, relativeDays, today } from '#lib/domain/dates';
	import { DUE_META } from '#lib/meta';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Amount from '#lib/ui/Amount.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import ErrorState from '#lib/ui/ErrorState.svelte';
	import type { CalendarEvent } from '#lib/types';

	let month = $state(monthKey(today()));
	const cal = loader(() => api.get<{ month: string; events: CalendarEvent[]; daily: { date: string; total: number }[] }>(`calendar?month=${month}`));
	const c = $derived(cal.value?.month === month ? cal.value : null);

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const cells = $derived.by(() => {
		const first = parseISO(`${month}-01`);
		const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
		const blanks = first.getDay();
		return [
			...Array.from({ length: blanks }, () => null),
			...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
		];
	});

	const byDate = $derived.by(() => {
		const m = new Map<string, CalendarEvent[]>();
		for (const e of c?.events ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
		return m;
	});
	const spend = $derived(new Map((c?.daily ?? []).map((d) => [d.date, d.total])));
	const maxSpend = $derived(Math.max(1, ...(c?.daily ?? []).map((d) => d.total)));

	/** Money still going out this month (unpaid dues + projected recurring outflows from today). */
	const outflows = $derived((c?.events ?? []).filter((e) => !e.paid && (e.overdue || e.date >= today()) && e.flow !== 'income'));
	const inflows = $derived((c?.events ?? []).filter((e) => !e.paid && e.date >= today() && e.flow === 'income'));
	const outTotal = $derived(outflows.reduce((s, e) => s + e.amount, 0));
	const inTotal = $derived(inflows.reduce((s, e) => s + e.amount, 0));

	let selected = $state<string | null>(null);
	const dayEvents = $derived(selected ? (byDate.get(selected) ?? []) : []);

	function pay(e: CalendarEvent) {
		selected = null;
		openQuickAdd({ type: 'transfer', to_account_id: e.ref_id, amount: e.amount, title: 'Pay card bill' });
	}
	function status(e: CalendarEvent) {
		if (e.paid) return { text: 'Paid ✓', cls: 'bg-green' };
		if (e.overdue) return { text: 'Overdue', cls: 'bg-red text-bg0h' };
		if (e.kind === 'recurring') return { text: 'Auto', cls: 'bg-bg1' };
		return { text: relativeDays(e.date), cls: 'bg-yellow' };
	}
</script>

<svelte:head><title>Calendar · Hishab</title></svelte:head>

<PageHeader title="Calendar" back="/plan" />

<header class="mb-3 flex items-center justify-between gap-2">
	<h2 class="nb-title truncate text-2xl">{formatMonth(month)}</h2>
	<div class="flex shrink-0 gap-2">
		<Button size="sm" class="min-h-9 min-w-9" onclick={() => (month = addMonths(`${month}-01`, -1).slice(0, 7))} aria-label="Previous month">←</Button>
		{#if month !== monthKey(today())}<Button size="sm" class="min-h-9" onclick={() => (month = monthKey(today()))}>Today</Button>{/if}
		<Button size="sm" class="min-h-9 min-w-9" onclick={() => (month = addMonths(`${month}-01`, 1).slice(0, 7))} aria-label="Next month">→</Button>
	</div>
</header>

{#if cal.error && !c}
	<ErrorState onretry={cal.reload} />
{:else}
	<div class="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
		<section class="nb-card overflow-hidden" class:opacity-60={!c}>
			<div class="grid grid-cols-7 border-b-2 border-ink bg-bg1 text-center text-[0.65rem] font-extrabold tracking-wider uppercase">
				{#each WEEKDAYS as w, i (w)}<div class="py-1.5 {i === 5 ? 'text-red-d' : ''}">{w}</div>{/each}
			</div>
			<div class="grid grid-cols-7 gap-px bg-bg2">
				{#each cells as date, i (date ?? `blank${i}`)}
					{#if !date}
						<div class="bg-bg"></div>
					{:else}
						{@const ev = byDate.get(date) ?? []}
						{@const s = spend.get(date) ?? 0}
						{@const isToday = date === today()}
						<button
							type="button"
							class="relative flex min-h-12 flex-col items-stretch bg-bg0h p-1 text-left hover:bg-bg1 sm:min-h-20 {selected === date ? 'outline-2 -outline-offset-2 outline-ink' : ''}"
							onclick={() => (selected = date)}
							aria-label="{formatDate(date, 'long')}: {ev.length} due{s ? `, spent ${formatBDT(s)}` : ''}"
						>
							{#if s}<span class="absolute inset-0 bg-orange" style="opacity:{0.08 + (s / maxSpend) * 0.32}"></span>{/if}
							<span
								class="relative flex size-6 items-center justify-center rounded-full text-xs font-extrabold {isToday ? 'border-2 border-ink bg-yellow' : ''}"
								>{Number(date.slice(8))}</span
							>
							{#if ev.length}
								<span class="relative mt-auto flex flex-wrap gap-0.5 sm:hidden">
									{#each ev.slice(0, 3) as e (e.kind + e.ref_id + e.date)}
										<span class="size-2 rounded-full border border-ink {e.paid ? 'opacity-40' : ''}" style="background:{DUE_META[e.kind].bg}"></span>
									{/each}
									{#if ev.length > 3}<span class="text-[0.55rem] leading-none font-bold">+</span>{/if}
								</span>
								<span class="relative mt-1 hidden space-y-0.5 sm:block">
									{#each ev.slice(0, 2) as e (e.kind + e.ref_id + e.date)}
										<span
											class="block truncate rounded-[3px] border border-ink px-1 text-[0.62rem] font-bold {e.paid ? 'line-through opacity-50' : ''}"
											style="background:{DUE_META[e.kind].bg}">{DUE_META[e.kind].icon} {formatCompact(e.amount)}</span
										>
									{/each}
									{#if ev.length > 2}<span class="block text-[0.6rem] font-bold">+{ev.length - 2} more</span>{/if}
								</span>
							{/if}
						</button>
					{/if}
				{/each}
			</div>
		</section>

		<aside class="mt-4 space-y-4 lg:mt-0">
			<div class="flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] font-bold">
				{#each Object.entries(DUE_META) as [k, m] (k)}
					<span class="flex items-center gap-1"><span class="size-2.5 rounded-full border border-ink" style="background:{m.bg}"></span>{m.label}</span>
				{/each}
				<span class="flex items-center gap-1"><span class="size-2.5 rounded-[2px] bg-orange/40"></span>Spending</span>
			</div>

			{#if c}
				<div class="grid grid-cols-2 gap-3">
					<div class="nb-card bg-red p-3 text-bg0h">
						<div class="text-[0.7rem] font-bold tracking-wider uppercase opacity-80">Still to pay</div>
						<div class="money truncate text-xl font-extrabold">{formatBDT(outTotal)}</div>
						<div class="text-xs opacity-80">{outflows.length} item{outflows.length === 1 ? '' : 's'}</div>
					</div>
					<div class="nb-card bg-green p-3">
						<div class="text-[0.7rem] font-bold tracking-wider uppercase opacity-80">Expected in</div>
						<div class="money truncate text-xl font-extrabold">{formatBDT(inTotal)}</div>
						<div class="text-xs opacity-80">from recurring</div>
					</div>
				</div>

				<div>
					<h3 class="nb-title mb-2 text-lg">Coming up</h3>
					{#if outflows.length + inflows.length === 0}
						<Empty icon="✅" title="Nothing left this month" />
					{:else}
						<ul class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
							{#each [...outflows, ...inflows].sort((a, b) => a.date.localeCompare(b.date)) as e (e.kind + e.ref_id + e.date)}
								<li>
									<button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg1" onclick={() => (selected = e.date)}>
										<span class="w-11 shrink-0 text-center text-[0.68rem] leading-tight font-extrabold uppercase {e.overdue ? 'text-red-d' : ''}">{formatDate(e.date)}</span>
										<span class="min-w-0 flex-1 truncate text-sm font-bold">{DUE_META[e.kind].icon} {e.title}</span>
										<Amount value={e.amount} type={e.flow === 'income' ? 'income' : undefined} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</aside>
	</div>
{/if}

<Sheet open={!!selected} title={selected ? formatDate(selected, 'long') : ''} onclose={() => (selected = null)}>
	{#if selected}
		{@const s = spend.get(selected) ?? 0}
		{#if s}
			<a href="/activity?month={selected.slice(0, 7)}" class="nb-flat mb-3 flex items-center justify-between bg-orange/20 px-3 py-2 text-sm font-bold">
				<span>Spent this day</span><span class="money">{formatBDT(s)}</span>
			</a>
		{/if}
		{#if dayEvents.length === 0}
			<p class="py-4 text-center text-sm text-muted">Nothing due {relativeDays(selected) === 'today' ? 'today' : 'on this day'}.</p>
		{:else}
			<ul class="nb-card divide-y-2 divide-ink overflow-hidden">
				{#each dayEvents as e (e.kind + e.ref_id)}
					{@const st = status(e)}
					<li class="flex items-start gap-3 px-3 py-2.5">
						<span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-ink text-lg" style="background:{DUE_META[e.kind].bg}"
							>{DUE_META[e.kind].icon}</span
						>
						<a href={e.href} class="min-w-0 flex-1" onclick={() => (selected = null)}>
							<span class="block truncate font-bold">{e.title}</span>
							<span class="block truncate text-xs text-muted">{e.subtitle}</span>
							<span class="mt-1 inline-block rounded-[3px] border border-ink px-1 text-[0.65rem] font-bold uppercase {st.cls}">{st.text}</span>
						</a>
						<div class="flex shrink-0 flex-col items-end gap-1.5">
							<Amount value={e.amount} type={e.flow === 'income' ? 'income' : undefined} />
							{#if e.kind === 'card' && !e.paid}<Button size="sm" variant="primary" onclick={() => pay(e)}>Pay</Button>{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</Sheet>
