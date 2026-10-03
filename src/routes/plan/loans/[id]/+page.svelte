<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { changed, confirmDialog, lastAccount, toast } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatDate, today } from '#lib/domain/dates';
	import { scheduleTotals } from '#lib/domain/emi';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Field from '#lib/ui/Field.svelte';
	import AccountSelect from '#lib/ui/AccountSelect.svelte';
	import StatTile from '#lib/ui/StatTile.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import type { Installment, Loan } from '#lib/types';

	const id = $derived(page.params.id!);
	const res = loader(() => api.get<{ loan: Loan; installments: Installment[] }>(`loans/${id}`));
	const loan = $derived(res.value?.loan);
	const rows = $derived(res.value?.installments ?? []);
	const totals = $derived(scheduleTotals(rows));
	const paid = $derived(rows.filter((r) => r.paid_date));
	const paidPrincipal = $derived(paid.reduce((s, r) => s + r.principal, 0));
	const nextRow = $derived(rows.find((r) => !r.paid_date));

	let paying = $state<Installment | null>(null);
	let payAccount = $state<string | null>(lastAccount());
	let payDate = $state(today());

	async function pay(e: SubmitEvent) {
		e.preventDefault();
		if (!paying || !payAccount) return;
		await api.post(`loans/${id}/pay`, { installment_id: paying.id, account_id: payAccount, date: payDate });
		toast(`EMI ${paying.seq} paid`);
		paying = null;
		await changed();
	}

	async function remove() {
		if (!(await confirmDialog('Delete this loan?', 'The schedule is removed. Payments you made stay in your history.'))) return;
		await api.del(`loans/${id}`);
		await changed();
		goto('/plan/loans');
	}
</script>

<svelte:head><title>{loan?.name ?? 'Loan'} · Hishab</title></svelte:head>

{#if loan}
	<PageHeader title={loan.name} back="/plan/loans" sub="{loan.lender ?? ''} · {loan.annual_rate}% {loan.method === 'flat' ? 'flat' : 'reducing'} · {loan.tenure_months} months">
		{#snippet actions()}<Button variant="danger" size="sm" onclick={remove}>Delete</Button>{/snippet}
	</PageHeader>

	<section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<StatTile label="Borrowed" bg="var(--color-bg1)"><span class="money font-extrabold">{formatBDT(loan.principal)}</span></StatTile>
		<StatTile label="Remaining" bg="var(--color-orange)"><span class="money font-extrabold">{formatBDT(loan.principal - paidPrincipal)}</span></StatTile>
		<StatTile label="Total interest"><span class="money font-extrabold">{formatBDT(totals.interest)}</span></StatTile>
		<StatTile label="Next EMI" bg="var(--color-yellow)">
			<span class="money font-extrabold">{nextRow ? formatBDT(nextRow.amount) : '—'}</span>
			{#snippet sub()}{nextRow ? formatDate(nextRow.due_date, 'long') : 'All paid 🎉'}{/snippet}
		</StatTile>
	</section>

	<div class="mt-4"><Progress value={paidPrincipal} max={loan.principal} color="var(--color-green)" warn={false} /></div>

	<section class="nb-card mt-6 overflow-x-auto">
		<table class="nb-table">
			<thead>
				<tr>
					<th>#</th><th>Due</th><th class="hidden text-right sm:table-cell">Principal</th><th class="hidden text-right sm:table-cell">Interest</th><th class="text-right">EMI</th><th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.id)}
					{@const overdue = !r.paid_date && r.due_date < today()}
					<tr class={r.paid_date ? 'opacity-60' : overdue ? 'bg-red/10' : ''}>
						<td class="font-bold">{r.seq}</td>
						<td class="whitespace-nowrap {overdue ? 'font-bold text-red-d' : ''}">{formatDate(r.due_date)} <span class="text-xs text-muted">'{r.due_date.slice(2, 4)}</span></td>
						<td class="money hidden text-right sm:table-cell">{formatBDT(r.principal, { decimals: true })}</td>
						<td class="money hidden text-right sm:table-cell">{formatBDT(r.interest, { decimals: true })}</td>
						<td class="money text-right font-bold whitespace-nowrap">{formatBDT(r.amount, { decimals: true })}</td>
						<td class="text-right">
							{#if r.paid_date}
								<span class="nb-chip bg-green">✓ {r.paid_txn_id === 'opening' ? 'before' : formatDate(r.paid_date)}</span>
							{:else if r.id === nextRow?.id}
								<Button size="sm" variant="primary" onclick={() => (paying = r)}>Pay</Button>
							{:else}
								<Button size="sm" onclick={() => (paying = r)}>Pay</Button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
	<p class="mt-2 text-xs text-muted">
		Principal is recorded as “Loan Repayment” and doesn't count as spending. Interest counts as an expense. Delete the payment from Activity to undo.
	</p>
{/if}

<Sheet open={!!paying} title="Pay EMI {paying?.seq ?? ''}" onclose={() => (paying = null)}>
	{#if paying}
		<form class="space-y-4" onsubmit={pay}>
			<div class="nb-flat bg-bg1 p-3 text-sm">
				<div class="money text-2xl font-extrabold">{formatBDT(paying.amount, { decimals: true })}</div>
				<div class="text-muted">Principal {formatBDT(paying.principal, { decimals: true })} + interest {formatBDT(paying.interest, { decimals: true })}</div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<Field label="Paid from"><AccountSelect bind:value={payAccount} /></Field>
				<Field label="Date"><input class="nb-input" type="date" bind:value={payDate} required /></Field>
			</div>
			<div class="flex gap-3">
				<Button onclick={() => (paying = null)}>Cancel</Button>
				<Button variant="primary" type="submit" class="flex-1" disabled={!payAccount}>Confirm payment</Button>
			</div>
		</form>
	{/if}
</Sheet>
