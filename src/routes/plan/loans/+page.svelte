<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatDate, relativeDays, today } from '#lib/domain/dates';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import LoanForm from '#lib/ui/LoanForm.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import type { Loan } from '#lib/types';

	const loans = loader(() => api.get<Loan[]>('loans'));
	let adding = $state(false);
	const outstanding = $derived((loans.value ?? []).filter((l) => l.status === 'active').reduce((s, l) => s + l.principal - (l.paid_principal ?? 0), 0));
</script>

<svelte:head><title>Loans · Hishab</title></svelte:head>

<PageHeader title="Loans" back="/plan" sub="Outstanding principal: {formatBDT(outstanding)}">
	{#snippet actions()}<Button variant="primary" onclick={() => (adding = true)}>＋ Loan</Button>{/snippet}
</PageHeader>

{#if loans.value?.length === 0}
	<Empty icon="🏦" title="No loans">Track your bKash digital loan or any bank/personal loan with a full EMI schedule.</Empty>
{/if}

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
	{#each loans.value ?? [] as l (l.id)}
		<a href="/plan/loans/{l.id}" class="nb-press block bg-bg0h p-4 {l.status === 'closed' ? 'opacity-60' : ''}">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<div class="truncate text-lg font-extrabold">{l.name}</div>
					<div class="text-xs text-muted">{l.lender ?? ''} · {l.annual_rate}% · {l.tenure_months} mo</div>
				</div>
				{#if l.status === 'closed'}<span class="nb-chip bg-green">Paid off</span>{/if}
			</div>
			<div class="mt-3 mb-1 flex justify-between text-sm font-bold">
				<span>{l.paid_count}/{l.tenure_months} EMIs</span>
				<span class="money">{formatBDT(l.principal - (l.paid_principal ?? 0))} left</span>
			</div>
			<Progress value={l.paid_principal ?? 0} max={l.principal} color="var(--color-orange)" warn={false} />
			{#if l.next_due}
				<div class="mt-3 flex justify-between text-sm">
					<span class="font-bold {l.next_due < today() ? 'text-red-d' : ''}">Next: {formatDate(l.next_due)} · {relativeDays(l.next_due)}</span>
					<span class="money font-extrabold">{formatBDT(l.next_amount ?? 0)}</span>
				</div>
			{/if}
		</a>
	{/each}
</div>

<Sheet bind:open={adding} title="Add loan">
	{#if adding}
		<LoanForm
			onDone={(id) => {
				adding = false;
				goto(`/plan/loans/${id}`);
			}}
		/>
	{/if}
</Sheet>
