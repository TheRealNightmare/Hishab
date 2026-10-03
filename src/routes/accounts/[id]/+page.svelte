<script lang="ts">
	import { page } from '$app/state';
	import { api, qs } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { openQuickAdd, refs } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatDate, relativeDays } from '#lib/domain/dates';
	import { typeMeta } from '#lib/meta';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import AccountForm from '#lib/ui/AccountForm.svelte';
	import TxnRow from '#lib/ui/TxnRow.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import type { CardSummary, Txn } from '#lib/types';

	const id = $derived(page.params.id!);
	const acc = $derived(refs.accounts.find((a) => a.id === id));
	const txns = loader(() => api.get<Txn[]>(`transactions${qs({ account: id, limit: 200 })}`));
	const card = loader(() => (acc?.type === 'card' ? api.get<CardSummary>(`cards/${id}`) : Promise.resolve(null)));
	let editing = $state(false);
</script>

<svelte:head><title>{acc?.name ?? 'Account'} · Hishab</title></svelte:head>

{#if !acc}
	<Empty icon="❓" title="Account not found"><a class="underline" href="/accounts">Back to accounts</a></Empty>
{:else}
	{@const m = typeMeta(acc.type)}
	<PageHeader title={acc.name} back="/accounts" sub="{m.icon} {acc.provider ?? m.label}{acc.archived ? ' · archived' : ''}">
		{#snippet actions()}<Button onclick={() => (editing = true)}>Edit</Button>{/snippet}
	</PageHeader>

	<section class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		<div class="col-span-2 sm:col-span-1">
			<StatTile label={acc.type === 'card' ? 'Outstanding' : 'Balance'} bg={acc.color ?? m.color}>
				<span class="money text-3xl font-extrabold">{formatBDT(acc.type === 'card' ? -(acc.balance ?? 0) : (acc.balance ?? 0))}</span>
			</StatTile>
		</div>
		{#if acc.type === 'card' && acc.credit_limit}
			<StatTile label="Available">
				<span class="money font-extrabold">{formatBDT(acc.credit_limit + (acc.balance ?? 0))}</span>
				{#snippet sub()}of {formatBDT(acc.credit_limit!)} limit{/snippet}
			</StatTile>
		{/if}
	</section>

	{#if acc.type === 'card'}
		{#if !acc.statement_day || !acc.due_day}
			<p class="mt-4 text-sm">Set the statement and due day (Edit) to track bills.</p>
		{:else if card.value}
			{@const c = card.value}
			<section class="nb-card mt-5 overflow-hidden">
				<div class="flex items-center justify-between border-b-2 border-ink bg-orange px-4 py-2">
					<h2 class="nb-title text-lg">Statement</h2>
					<span class="text-xs font-bold">{formatDate(c.period_start)} – {formatDate(c.period_end)}</span>
				</div>
				<div class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
					<div>
						<div class="nb-label">Bill</div>
						<div class="money text-xl font-extrabold">{formatBDT(c.statement_amount)}</div>
					</div>
					<div>
						<div class="nb-label">Still due</div>
						<div class="money text-xl font-extrabold {c.remaining > 0 ? 'text-red-d' : 'text-green-d'}">{formatBDT(c.remaining)}</div>
					</div>
					<div>
						<div class="nb-label">Minimum</div>
						<div class="money text-xl font-extrabold">{formatBDT(c.min_due)}</div>
					</div>
					<div>
						<div class="nb-label">Due</div>
						<div class="text-lg font-extrabold">{formatDate(c.due_date)}</div>
						<div class="text-xs text-muted">{relativeDays(c.due_date)}</div>
					</div>
				</div>
				{#if c.statement_amount > 0}
					<div class="px-4 pb-2"><Progress value={c.paid_since} max={c.statement_amount} color="var(--color-green)" warn={false} /></div>
				{/if}
				<div class="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-bg3 p-4">
					<span class="text-xs text-muted">Next statement closes {formatDate(c.next_close)}</span>
					<div class="flex gap-2">
						{#if c.min_due > 0}
							<Button size="sm" onclick={() => openQuickAdd({ type: 'transfer', to_account_id: id, amount: c.min_due, title: 'Pay minimum' })}>Pay min</Button>
						{/if}
						<Button
							size="sm"
							variant="primary"
							disabled={c.remaining === 0 && c.outstanding === 0}
							onclick={() => openQuickAdd({ type: 'transfer', to_account_id: id, amount: c.remaining || c.outstanding, title: 'Pay card bill' })}
							>Pay bill</Button
						>
					</div>
				</div>
			</section>
		{/if}
	{/if}

	<div class="mt-5 flex flex-wrap gap-2">
		{#if acc.type === 'card'}
			<Button variant="primary" onclick={() => openQuickAdd({ type: 'expense', account_id: id })}>＋ Card purchase</Button>
		{:else}
			<Button onclick={() => openQuickAdd({ type: 'expense', account_id: id })}>＋ Expense</Button>
			<Button onclick={() => openQuickAdd({ type: 'income', account_id: id })}>＋ Income</Button>
			<Button onclick={() => openQuickAdd({ type: 'transfer', account_id: id })}>⇄ Transfer</Button>
		{/if}
	</div>

	<section class="mt-6">
		<h2 class="nb-title mb-2 text-xl">History</h2>
		{#if txns.value?.length === 0}
			<Empty icon="🧾" title="No transactions yet" />
		{:else if txns.value}
			<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
				{#each txns.value as t (t.id)}<TxnRow {t} showDate />{/each}
			</div>
		{/if}
	</section>

	<Sheet bind:open={editing} title="Edit account">
		{#if editing}<AccountForm account={acc} onDone={() => (editing = false)} />{/if}
	</Sheet>
{/if}
