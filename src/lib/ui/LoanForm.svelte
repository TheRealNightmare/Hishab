<script lang="ts">
	import Field from './Field.svelte';
	import MoneyInput from './MoneyInput.svelte';
	import Button from './Button.svelte';
	import AccountSelect from './AccountSelect.svelte';
	import Segmented from './Segmented.svelte';
	import { api } from '#lib/api';
	import { changed, toast } from '#lib/stores.svelte';
	import { buildSchedule, scheduleTotals } from '#lib/domain/emi';
	import { addMonths, today } from '#lib/domain/dates';
	import { formatBDT } from '#lib/domain/money';
	import { BKASH_LOAN_PRESET } from '#lib/meta';

	let { onDone }: { onDone: (id: string) => void } = $props();

	let mode = $state<'new' | 'existing'>('new');
	let name = $state('');
	let lender = $state('');
	let principal = $state<number | null>(null);
	let rate = $state<number>(9);
	let tenure = $state<number>(12);
	let method = $state<'reducing' | 'flat'>('reducing');
	let fee = $state<number | null>(null);
	let disbursedOn = $state(today());
	let startDate = $state(addMonths(today(), 1));
	let account = $state<string | null>(null);
	let paidCount = $state(0);
	let saving = $state(false);

	function bkashPreset() {
		name = BKASH_LOAN_PRESET.name;
		lender = BKASH_LOAN_PRESET.lender;
		rate = BKASH_LOAN_PRESET.annual_rate;
		tenure = BKASH_LOAN_PRESET.tenure_months;
		method = BKASH_LOAN_PRESET.method;
	}

	const preview = $derived(
		principal && tenure > 0 ? buildSchedule({ principal, annual_rate: rate || 0, tenure_months: tenure, method, start_date: startDate }) : []
	);
	const totals = $derived(scheduleTotals(preview));

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!principal) return;
		saving = true;
		try {
			const r = await api.post('loans', {
				name: name.trim() || 'Loan',
				lender: lender.trim() || null,
				principal,
				annual_rate: rate || 0,
				tenure_months: tenure,
				method,
				processing_fee: fee ?? 0,
				start_date: startDate,
				disburse_account_id: mode === 'new' ? account : null,
				disbursed_on: disbursedOn,
				paid_installments: mode === 'existing' ? paidCount : 0
			});
			toast('Loan added');
			await changed();
			onDone(r.id);
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={save}>
	<Segmented
		options={[
			{ value: 'new', label: 'New loan' },
			{ value: 'existing', label: 'Already running' }
		]}
		bind:value={mode}
	/>
	<button type="button" class="nb-chip bg-[#e2136e] text-bg0h" onclick={bkashPreset}>⚡ bKash Digital Loan preset</button>

	<div class="grid grid-cols-2 gap-3">
		<Field label="Name"><input class="nb-input" bind:value={name} placeholder="e.g. Laptop loan" required /></Field>
		<Field label="Lender"><input class="nb-input" bind:value={lender} placeholder="Bank / person" /></Field>
		<Field label="Loan amount"><MoneyInput bind:value={principal} required /></Field>
		<Field label="Interest % / year"><input class="nb-input" type="number" step="0.01" min="0" bind:value={rate} /></Field>
		<Field label="Months"><input class="nb-input" type="number" min="1" max="480" bind:value={tenure} required /></Field>
		<Field label="Method">
			<select class="nb-input" bind:value={method}>
				<option value="reducing">Reducing balance (EMI)</option>
				<option value="flat">Flat rate</option>
			</select>
		</Field>
		<Field label="First EMI due"><input class="nb-input" type="date" bind:value={startDate} required /></Field>
		{#if mode === 'new'}
			<Field label="Processing fee"><MoneyInput bind:value={fee} /></Field>
			<Field label="Money received in"><AccountSelect bind:value={account} placeholder="Choose account" /></Field>
			<Field label="Received on"><input class="nb-input" type="date" bind:value={disbursedOn} /></Field>
		{:else}
			<Field label="EMIs already paid" hint="Marked paid without touching balances">
				<input class="nb-input" type="number" min="0" max={tenure} bind:value={paidCount} />
			</Field>
		{/if}
	</div>

	{#if preview.length}
		<div class="nb-flat bg-bg1 p-3 text-sm">
			<div class="flex flex-wrap justify-between gap-2 font-bold">
				<span>EMI <span class="money">{formatBDT(preview[0].amount, { decimals: true })}</span></span>
				<span>Interest <span class="money">{formatBDT(totals.interest)}</span></span>
				<span>Total <span class="money">{formatBDT(totals.amount + (fee ?? 0))}</span></span>
			</div>
			{#if rate === BKASH_LOAN_PRESET.annual_rate && name === BKASH_LOAN_PRESET.name}
				<p class="mt-1 text-xs text-muted">Check the rate and tenure against your bKash app. The preset is only a starting point.</p>
			{/if}
		</div>
	{/if}

	<Button variant="primary" type="submit" class="w-full" disabled={saving || !principal || (mode === 'new' && !account)}>Add loan</Button>
</form>
