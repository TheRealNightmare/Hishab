<script lang="ts">
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { changed, confirmDialog, lastAccount, toast } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatDate, relativeDays, today } from '#lib/domain/dates';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Field from '#lib/ui/Field.svelte';
	import MoneyInput from '#lib/ui/MoneyInput.svelte';
	import AccountSelect from '#lib/ui/AccountSelect.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import type { Semester, SemesterFee } from '#lib/types';

	const sems = loader(() => api.get<Semester[]>('semesters'));

	// Semester form
	let semOpen = $state(false);
	let semEdit = $state<Semester | null>(null);
	let semName = $state('');
	let semStart = $state(today());
	let semEnd = $state(today());

	function openSem(s: Semester | null) {
		semEdit = s;
		semName = s?.name ?? '';
		semStart = s?.start_date ?? today();
		semEnd = s?.end_date ?? today();
		semOpen = true;
	}
	async function saveSem(e: SubmitEvent) {
		e.preventDefault();
		const body = { name: semName, start_date: semStart, end_date: semEnd };
		if (semEdit) await api.put(`semesters/${semEdit.id}`, body);
		else await api.post('semesters', body);
		semOpen = false;
		toast('Saved');
		await changed();
	}
	async function deleteSem(s: Semester) {
		if (!(await confirmDialog(`Delete ${s.name}?`, 'Its fee schedule is removed. Payments stay in history.'))) return;
		await api.del(`semesters/${s.id}`);
		semOpen = false;
		await changed();
	}

	// Fee form
	let feeFor = $state<Semester | null>(null);
	let feeLabel = $state('');
	let feeAmount = $state<number | null>(null);
	let feeDue = $state<string>('');
	async function saveFee(e: SubmitEvent) {
		e.preventDefault();
		if (!feeFor || !feeAmount) return;
		await api.post('semester-fees', { semester_id: feeFor.id, label: feeLabel, amount: feeAmount, due_date: feeDue || null });
		feeLabel = '';
		feeAmount = null;
		feeDue = '';
		feeFor = null;
		toast('Fee added');
		await changed();
	}
	async function deleteFee(f: SemesterFee) {
		if (!(await confirmDialog(`Remove “${f.label}”?`, f.paid_txn_id ? 'The payment stays in your history.' : ''))) return;
		await api.del(`semester-fees/${f.id}`);
		await changed();
	}

	// Pay
	let paying = $state<SemesterFee | null>(null);
	let payAccount = $state<string | null>(lastAccount());
	let payDate = $state(today());
	async function pay(e: SubmitEvent) {
		e.preventDefault();
		if (!paying || !payAccount) return;
		await api.post(`semester-fees/${paying.id}/pay`, { account_id: payAccount, date: payDate });
		paying = null;
		toast('Fee paid');
		await changed();
	}
</script>

<svelte:head><title>University · Hishab</title></svelte:head>

<PageHeader title="University" back="/plan" sub="Semester fees and everything spent under the University category">
	{#snippet actions()}<Button variant="primary" onclick={() => openSem(null)}>＋ Semester</Button>{/snippet}
</PageHeader>

{#if sems.value?.length === 0}
	<Empty icon="🎓" title="No semesters yet">Add a semester with its dates, then its fee installments.</Empty>
{/if}

<div class="space-y-6">
	{#each sems.value ?? [] as s (s.id)}
		{@const current = s.start_date <= today() && today() <= s.end_date}
		<section class="nb-card overflow-hidden">
			<header class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-4 py-3 {current ? 'bg-blue text-bg0h' : 'bg-bg1'}">
				<div>
					<h2 class="nb-title text-xl">{s.name} {current ? '· now' : ''}</h2>
					<div class="text-xs font-bold opacity-80">{formatDate(s.start_date, 'long')} – {formatDate(s.end_date, 'long')}</div>
				</div>
				<Button size="sm" onclick={() => openSem(s)}>Edit</Button>
			</header>
			<div class="grid grid-cols-3 gap-3 p-4 text-center">
				<div>
					<div class="nb-label">Fees</div>
					<div class="money font-extrabold">{formatBDT(s.fees_total ?? 0)}</div>
				</div>
				<div>
					<div class="nb-label">Fees paid</div>
					<div class="money font-extrabold text-green-d">{formatBDT(s.fees_paid ?? 0)}</div>
				</div>
				<div>
					<div class="nb-label">Total cost</div>
					<div class="money font-extrabold">{formatBDT(s.spent ?? 0)}</div>
				</div>
			</div>
			{#if s.fees_total}
				<div class="px-4 pb-3"><Progress value={s.fees_paid ?? 0} max={s.fees_total} color="var(--color-green)" warn={false} /></div>
			{/if}
			<ul class="divide-y divide-dashed divide-bg3 border-t-2 border-ink">
				{#each s.fees ?? [] as f (f.id)}
					{@const overdue = !f.paid_txn_id && f.due_date && f.due_date < today()}
					<li class="flex items-center gap-3 px-4 py-2.5 {overdue ? 'bg-red/10' : ''}">
						<div class="min-w-0 flex-1">
							<div class="font-bold">{f.label}</div>
							{#if f.due_date}
								<div class="text-xs {overdue ? 'font-bold text-red-d' : 'text-muted'}">Due {formatDate(f.due_date, 'long')} · {relativeDays(f.due_date)}</div>
							{/if}
						</div>
						<span class="money font-extrabold">{formatBDT(f.amount)}</span>
						{#if f.paid_txn_id}
							<span class="nb-chip bg-green">✓ Paid</span>
						{:else}
							<Button size="sm" variant="primary" onclick={() => (paying = f)}>Pay</Button>
						{/if}
						<button class="text-muted hover:text-red-d" aria-label="Remove fee" onclick={() => deleteFee(f)}>✕</button>
					</li>
				{/each}
				<li class="px-4 py-2.5">
					<button class="text-xs font-bold tracking-wider uppercase text-blue-d underline" onclick={() => (feeFor = s)}>＋ Add fee installment</button>
				</li>
			</ul>
		</section>
	{/each}
</div>
<p class="mt-3 text-xs text-muted">Total cost = paid fees + anything in the University category dated within the semester.</p>

<Sheet bind:open={semOpen} title={semEdit ? 'Edit semester' : 'New semester'}>
	<form class="space-y-4" onsubmit={saveSem}>
		<Field label="Name"><input class="nb-input" bind:value={semName} placeholder="e.g. Fall 2026" required /></Field>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Starts"><input class="nb-input" type="date" bind:value={semStart} required /></Field>
			<Field label="Ends"><input class="nb-input" type="date" bind:value={semEnd} min={semStart} required /></Field>
		</div>
		<div class="flex gap-3">
			{#if semEdit}<Button variant="danger" onclick={() => deleteSem(semEdit!)}>Delete</Button>{/if}
			<Button variant="primary" type="submit" class="flex-1">Save</Button>
		</div>
	</form>
</Sheet>

<Sheet open={!!feeFor} title="Add fee · {feeFor?.name ?? ''}" onclose={() => (feeFor = null)}>
	<form class="space-y-4" onsubmit={saveFee}>
		<div class="flex flex-wrap gap-2">
			{#each ['Admission', 'Installment 1', 'Installment 2', 'Installment 3', 'Lab fee', 'Exam fee'] as l (l)}
				<button type="button" class="nb-chip {feeLabel === l ? 'bg-yellow' : 'bg-bg0h'}" onclick={() => (feeLabel = l)}>{l}</button>
			{/each}
		</div>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Label"><input class="nb-input" bind:value={feeLabel} required /></Field>
			<Field label="Amount"><MoneyInput bind:value={feeAmount} required /></Field>
			<Field label="Due date"><input class="nb-input" type="date" bind:value={feeDue} /></Field>
		</div>
		<Button variant="primary" type="submit" class="w-full" disabled={!feeAmount || !feeLabel}>Add</Button>
	</form>
</Sheet>

<Sheet open={!!paying} title="Pay {paying?.label ?? ''}" onclose={() => (paying = null)}>
	{#if paying}
		<form class="space-y-4" onsubmit={pay}>
			<div class="money text-3xl font-extrabold">{formatBDT(paying.amount)}</div>
			<div class="grid grid-cols-2 gap-3">
				<Field label="Paid from"><AccountSelect bind:value={payAccount} /></Field>
				<Field label="Date"><input class="nb-input" type="date" bind:value={payDate} required /></Field>
			</div>
			<Button variant="primary" type="submit" class="w-full" disabled={!payAccount}>Confirm payment</Button>
		</form>
	{/if}
</Sheet>
