<script lang="ts">
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { changed, confirmDialog, openQuickAdd, refs, toast } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { diffDays, formatDate, monthKey, today, addMonths } from '#lib/domain/dates';
	import { SWATCHES } from '#lib/meta';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Field from '#lib/ui/Field.svelte';
	import MoneyInput from '#lib/ui/MoneyInput.svelte';
	import AccountSelect from '#lib/ui/AccountSelect.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import type { Goal, Scheme } from '#lib/types';

	const goals = loader(() => api.get<Goal[]>('goals'));
	const schemes = loader(() => api.get<Scheme[]>('schemes'));
	const savingsAccounts = $derived(refs.accounts.filter((a) => a.type === 'savings' && !a.archived));

	/* Goals */
	let goalOpen = $state(false);
	let goalEdit = $state<Goal | null>(null);
	let gName = $state('');
	let gTarget = $state<number | null>(null);
	let gDeadline = $state('');
	let gAccount = $state<string | null>(null);
	let gColor = $state(SWATCHES[4]);

	function openGoal(g: Goal | null) {
		goalEdit = g;
		gName = g?.name ?? '';
		gTarget = g?.target ?? null;
		gDeadline = g?.deadline ?? '';
		gAccount = g?.account_id ?? savingsAccounts[0]?.id ?? null;
		gColor = g?.color ?? SWATCHES[4];
		goalOpen = true;
	}
	async function saveGoal(e: SubmitEvent) {
		e.preventDefault();
		const body = { name: gName, target: gTarget, deadline: gDeadline || null, account_id: gAccount, color: gColor };
		if (goalEdit) await api.put(`goals/${goalEdit.id}`, body);
		else await api.post('goals', body);
		goalOpen = false;
		toast('Goal saved');
		await changed();
	}
	async function deleteGoal() {
		if (!goalEdit || !(await confirmDialog(`Delete goal “${goalEdit.name}”?`, 'Money stays in the account. Only the goal is removed.'))) return;
		await api.del(`goals/${goalEdit.id}`);
		goalOpen = false;
		await changed();
	}
	function contribute(g: Goal) {
		openQuickAdd({ type: 'transfer', to_account_id: g.account_id ?? undefined, goal_id: g.id, title: `Add to ${g.name}` });
	}
	function withdraw(g: Goal) {
		openQuickAdd({ type: 'transfer', account_id: g.account_id ?? undefined, goal_id: g.id, title: `Withdraw from ${g.name}` });
	}
	function monthlyNeeded(g: Goal) {
		if (!g.deadline) return null;
		const left = g.target - (g.saved ?? 0);
		const months = Math.max(1, Math.ceil(diffDays(g.deadline, today()) / 30));
		return left > 0 ? Math.ceil(left / months) : 0;
	}

	/* Schemes (DPS/FDR) */
	let schOpen = $state(false);
	let schEdit = $state<Scheme | null>(null);
	let sType = $state<'dps' | 'fdr'>('dps');
	let sName = $state('');
	let sBank = $state('');
	let sAccount = $state<string | null>(null);
	let sMonthly = $state<number | null>(null);
	let sPrincipal = $state<number | null>(null);
	let sRate = $state<number | null>(null);
	let sStart = $state(today());
	let sMaturity = $state(addMonths(today(), 36));
	let sExpected = $state<number | null>(null);
	let sDay = $state<number | null>(Number(today().slice(8)));

	function openScheme(s: Scheme | null) {
		schEdit = s;
		sType = s?.type ?? 'dps';
		sName = s?.name ?? '';
		sBank = s?.bank ?? '';
		sAccount = s?.account_id ?? null;
		sMonthly = s?.monthly_amount ?? null;
		sPrincipal = s?.principal ?? null;
		sRate = s?.annual_rate ?? null;
		sStart = s?.start_date ?? today();
		sMaturity = s?.maturity_date ?? addMonths(today(), 36);
		sExpected = s?.expected_maturity ?? null;
		sDay = s?.installment_day ?? Number(today().slice(8));
		schOpen = true;
	}
	async function saveScheme(e: SubmitEvent) {
		e.preventDefault();
		let account = sAccount;
		if (!account) {
			// Each DPS/FDR gets its own savings account so its balance is tracked separately.
			account = (await api.post('accounts', { name: sName || `${sBank} ${sType.toUpperCase()}`, type: 'savings', provider: sBank || null, opening_balance: 0 })).id;
		}
		const body = {
			type: sType,
			name: sName || `${sBank} ${sType.toUpperCase()}`,
			bank: sBank || null,
			account_id: account,
			monthly_amount: sType === 'dps' ? sMonthly : null,
			principal: sType === 'fdr' ? sPrincipal : null,
			annual_rate: sRate,
			start_date: sStart,
			maturity_date: sMaturity,
			expected_maturity: sExpected,
			installment_day: sType === 'dps' ? sDay : null
		};
		if (schEdit) await api.put(`schemes/${schEdit.id}`, body);
		else await api.post('schemes', body);
		schOpen = false;
		toast('Saved');
		await changed();
	}
	async function deleteScheme() {
		if (!schEdit || !(await confirmDialog(`Delete ${schEdit.name}?`, 'Deposits stay in history; the linked savings account remains.'))) return;
		await api.del(`schemes/${schEdit.id}`);
		schOpen = false;
		await changed();
	}
	function deposit(s: Scheme) {
		openQuickAdd({
			type: 'transfer',
			to_account_id: s.account_id ?? undefined,
			scheme_id: s.id,
			amount: s.type === 'dps' ? (s.monthly_amount ?? undefined) : (s.principal ?? undefined),
			title: `${s.type === 'dps' ? 'DPS installment' : 'FDR deposit'} · ${s.name}`
		});
	}
	function dpsMonths(s: Scheme) {
		const [y1, m1] = s.start_date.split('-').map(Number);
		const [y2, m2] = s.maturity_date.split('-').map(Number);
		return (y2 - y1) * 12 + (m2 - m1);
	}
	const thisMonth = monthKey(today());
</script>

<svelte:head><title>Savings · Hishab</title></svelte:head>

<PageHeader title="Savings" back="/plan" />

<!-- Goals -->
<section>
	<div class="mb-2 flex items-center justify-between">
		<h2 class="nb-title text-xl">🎯 Goals</h2>
		<Button size="sm" variant="primary" onclick={() => openGoal(null)}>＋ Goal</Button>
	</div>
	{#if goals.value?.length === 0}
		<Empty icon="🎯" title="No goals yet">Laptop, emergency fund, Eid shopping. Set a target and move money into it.</Empty>
	{/if}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each goals.value ?? [] as g (g.id)}
			{@const saved = g.saved ?? 0}
			{@const need = monthlyNeeded(g)}
			<div class="nb-card p-4" class:opacity-60={g.archived}>
				<div class="flex items-start justify-between gap-2">
					<div>
						<div class="text-lg font-extrabold">{g.name}</div>
						<div class="text-xs text-muted">
							{refs.accounts.find((a) => a.id === g.account_id)?.name ?? 'No account'}{g.deadline ? ` · by ${formatDate(g.deadline, 'long')}` : ''}
						</div>
					</div>
					<button class="text-xs font-bold underline" onclick={() => openGoal(g)}>Edit</button>
				</div>
				<div class="mt-3 mb-1 flex items-baseline justify-between">
					<span class="money text-2xl font-extrabold">{formatBDT(saved)}</span>
					<span class="money text-sm font-bold text-muted">of {formatBDT(g.target)} · {Math.floor((saved / g.target) * 100)}%</span>
				</div>
				<Progress value={saved} max={g.target} color={g.color ?? 'var(--color-aqua)'} warn={false} />
				{#if need}<div class="mt-2 text-xs font-bold">Save {formatBDT(need)}/month to hit the deadline</div>{/if}
				{#if saved >= g.target}<div class="mt-2 text-xs font-bold text-green-d">Goal reached 🎉</div>{/if}
				<div class="mt-3 flex gap-2">
					<Button size="sm" variant="green" onclick={() => contribute(g)} disabled={!g.account_id}>＋ Add money</Button>
					<Button size="sm" onclick={() => withdraw(g)} disabled={!g.account_id || saved <= 0}>Withdraw</Button>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- DPS / FDR -->
<section class="mt-8">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="nb-title text-xl">🏦 DPS & FDR</h2>
		<Button size="sm" variant="primary" onclick={() => openScheme(null)}>＋ Add</Button>
	</div>
	{#if schemes.value?.length === 0}
		<Empty icon="🏦" title="No deposit schemes">Track a monthly DPS or a fixed deposit with its maturity date.</Empty>
	{/if}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each schemes.value ?? [] as s (s.id)}
			{@const deposited = s.deposited ?? 0}
			{@const target = s.type === 'dps' ? (s.monthly_amount ?? 0) * dpsMonths(s) : (s.principal ?? 0)}
			{@const daysLeft = diffDays(s.maturity_date, today())}
			<div class="nb-card p-4" class:opacity-60={s.status !== 'active'}>
				<div class="flex items-start justify-between gap-2">
					<div>
						<span class="nb-chip {s.type === 'dps' ? 'bg-aqua' : 'bg-purple text-bg0h'}">{s.type.toUpperCase()}</span>
						<div class="mt-1 text-lg font-extrabold">{s.name}</div>
						<div class="text-xs text-muted">{s.bank ?? ''}{s.annual_rate ? ` · ${s.annual_rate}%` : ''} · matures {formatDate(s.maturity_date, 'long')}</div>
					</div>
					<button class="text-xs font-bold underline" onclick={() => openScheme(s)}>Edit</button>
				</div>
				<div class="mt-3 mb-1 flex items-baseline justify-between">
					<span class="money text-2xl font-extrabold">{formatBDT(deposited)}</span>
					<span class="text-xs font-bold text-muted">{daysLeft > 0 ? `${Math.ceil(daysLeft / 30)} months left` : 'Matured'}</span>
				</div>
				{#if target}<Progress value={deposited} max={target} color="var(--color-aqua)" warn={false} />{/if}
				{#if s.expected_maturity}<div class="mt-2 text-xs font-bold">Expected at maturity: {formatBDT(s.expected_maturity)}</div>{/if}
				{#if s.status === 'active'}
					<div class="mt-3 flex items-center gap-2">
						{#if s.type === 'dps'}
							{#if (s.paid_this_month ?? 0) >= (s.monthly_amount ?? 0)}
								<span class="nb-chip bg-green">✓ {thisMonth.slice(5)}/{thisMonth.slice(2, 4)} paid</span>
							{:else}
								<Button size="sm" variant="green" onclick={() => deposit(s)}>Pay {formatBDT(s.monthly_amount ?? 0)}</Button>
								<span class="text-xs text-muted">due on {s.installment_day}</span>
							{/if}
						{:else if deposited === 0}
							<Button size="sm" variant="green" onclick={() => deposit(s)}>Record deposit</Button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>

<!-- Savings accounts -->
<section class="mt-8">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="nb-title text-xl">🐖 Savings accounts</h2>
		<Button size="sm" href="/accounts?new=1">＋ Account</Button>
	</div>
	{#if savingsAccounts.length === 0}
		<p class="text-sm text-muted">No savings accounts yet.</p>
	{:else}
		<div class="nb-card divide-y-2 divide-ink overflow-hidden">
			{#each savingsAccounts as a (a.id)}
				<a href="/accounts/{a.id}" class="flex items-center justify-between px-4 py-3 hover:bg-bg1">
					<span class="font-bold">{a.name}</span>
					<span class="money font-extrabold">{formatBDT(a.balance ?? 0)}</span>
				</a>
			{/each}
		</div>
	{/if}
</section>

<Sheet bind:open={goalOpen} title={goalEdit ? 'Edit goal' : 'New goal'}>
	<form class="space-y-4" onsubmit={saveGoal}>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Goal" class="col-span-2"><input class="nb-input" bind:value={gName} placeholder="e.g. New laptop" required /></Field>
			<Field label="Target"><MoneyInput bind:value={gTarget} required /></Field>
			<Field label="Deadline"><input class="nb-input" type="date" bind:value={gDeadline} /></Field>
			<Field label="Kept in" class="col-span-2" hint="Money moved into this account and tagged to the goal counts toward it">
				<AccountSelect bind:value={gAccount} types={['savings', 'bank', 'wallet', 'cash']} />
			</Field>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each SWATCHES as c (c)}
				<button type="button" aria-label="Colour {c}" class="size-7 rounded-[4px] border-2 border-ink {gColor === c ? 'outline-3 outline-offset-1 outline-ink' : ''}" style="background:{c}" onclick={() => (gColor = c)}></button>
			{/each}
		</div>
		<div class="flex gap-3">
			{#if goalEdit}<Button variant="danger" onclick={deleteGoal}>Delete</Button>{/if}
			<Button variant="primary" type="submit" class="flex-1" disabled={!gTarget || !gAccount}>Save</Button>
		</div>
	</form>
</Sheet>

<Sheet bind:open={schOpen} title={schEdit ? 'Edit scheme' : 'New DPS / FDR'}>
	<form class="space-y-4" onsubmit={saveScheme}>
		<Segmented
			options={[
				{ value: 'dps', label: 'DPS (monthly)' },
				{ value: 'fdr', label: 'FDR (fixed)' }
			]}
			bind:value={sType}
		/>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Name"><input class="nb-input" bind:value={sName} placeholder="e.g. BRAC DPS" /></Field>
			<Field label="Bank"><input class="nb-input" bind:value={sBank} placeholder="BRAC, DBBL…" /></Field>
			{#if sType === 'dps'}
				<Field label="Monthly amount"><MoneyInput bind:value={sMonthly} required /></Field>
				<Field label="Installment day"><input class="nb-input" type="number" min="1" max="31" bind:value={sDay} /></Field>
			{:else}
				<Field label="Deposit amount"><MoneyInput bind:value={sPrincipal} required /></Field>
			{/if}
			<Field label="Interest % / year"><input class="nb-input" type="number" step="0.01" bind:value={sRate} /></Field>
			<Field label="Start date"><input class="nb-input" type="date" bind:value={sStart} required /></Field>
			<Field label="Maturity date"><input class="nb-input" type="date" bind:value={sMaturity} required /></Field>
			<Field label="Expected at maturity"><MoneyInput bind:value={sExpected} /></Field>
			<Field label="Linked account" hint="Leave empty to create one">
				<AccountSelect bind:value={sAccount} types={['savings']} placeholder="Create new" />
			</Field>
		</div>
		<div class="flex gap-3">
			{#if schEdit}<Button variant="danger" onclick={deleteScheme}>Delete</Button>{/if}
			<Button variant="primary" type="submit" class="flex-1">Save</Button>
		</div>
	</form>
</Sheet>
