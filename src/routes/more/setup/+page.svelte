<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '#lib/api';
	import { changed, refs, toast } from '#lib/stores.svelte';
	import { addMonths, today } from '#lib/domain/dates';
	import { formatBDT } from '#lib/domain/money';
	import { typeMeta, WALLET_PROVIDERS } from '#lib/meta';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import MoneyInput from '#lib/ui/MoneyInput.svelte';
	import AccountSelect from '#lib/ui/AccountSelect.svelte';
	import LoanForm from '#lib/ui/LoanForm.svelte';
	import type { AccountType } from '#lib/types';

	let step = $state(1);
	const steps = ['Accounts', 'Cards', 'Loans', 'Income', 'Done'];

	/* Step 1: accounts */
	interface Row {
		key: number;
		type: AccountType;
		name: string;
		provider: string | null;
		balance: number | null;
	}
	let k = 0;
	let rows = $state<Row[]>([
		{ key: k++, type: 'cash', name: 'Cash', provider: null, balance: null },
		{ key: k++, type: 'wallet', name: 'bKash', provider: 'bKash', balance: null },
		{ key: k++, type: 'bank', name: '', provider: null, balance: null }
	]);
	function addRow(type: AccountType, provider: string | null = null) {
		rows.push({ key: k++, type, name: provider ?? '', provider, balance: null });
	}

	/* Step 2: cards */
	interface CardRow {
		key: number;
		name: string;
		owed: number | null;
		limit: number | null;
		statement: number | null;
		due: number | null;
	}
	let cards = $state<CardRow[]>([]);

	let busy = $state(false);

	async function saveAccounts() {
		busy = true;
		try {
			for (const r of rows.filter((r) => r.name.trim() || r.balance)) {
				await api.post('accounts', {
					name: r.name.trim() || typeMeta(r.type).label,
					type: r.type,
					provider: r.provider,
					opening_balance: r.balance ?? 0,
					color: WALLET_PROVIDERS.find((p) => p.name === r.provider)?.color ?? null
				});
			}
			await changed();
			step = 2;
		} finally {
			busy = false;
		}
	}

	async function saveCards() {
		busy = true;
		try {
			for (const c of cards.filter((c) => c.name.trim())) {
				await api.post('accounts', {
					name: c.name.trim(),
					type: 'card',
					opening_balance: -(c.owed ?? 0),
					credit_limit: c.limit,
					statement_day: c.statement,
					due_day: c.due,
					min_due_pct: 5
				});
			}
			await changed();
			step = 3;
		} finally {
			busy = false;
		}
	}

	/* Step 3: loans */
	let loansAdded = $state(0);
	let showLoanForm = $state(false);

	/* Step 4: income */
	let salary = $state<number | null>(null);
	let salaryDay = $state(1);
	let salaryAccount = $state<string | null>(null);
	let tuition = $state<number | null>(null);
	let tuitionDay = $state(1);
	let allowance = $state<number | null>(null);
	let allowanceDay = $state(1);

	function nextOn(day: number) {
		const t = today();
		const thisMonth = `${t.slice(0, 7)}-${String(Math.min(day, 28)).padStart(2, '0')}`;
		return thisMonth > t ? thisMonth : addMonths(thisMonth, 1, day);
	}

	async function saveIncome() {
		busy = true;
		try {
			const acc = salaryAccount ?? refs.accounts.find((a) => a.type === 'bank')?.id ?? refs.accounts[0]?.id;
			const add = async (name: string, amount: number | null, day: number, category_id: string) => {
				if (!amount || !acc) return;
				await api.post('recurring', {
					name,
					freq: 'monthly',
					day,
					next_date: nextOn(day),
					template: { type: 'income', amount, account_id: acc, category_id }
				});
			};
			await add('Salary', salary, salaryDay, 'cat_salary');
			await add('Tuition', tuition, tuitionDay, 'cat_tuition');
			await add('Family allowance', allowance, allowanceDay, 'cat_allowance');
			await finish();
		} finally {
			busy = false;
		}
	}

	async function finish() {
		await api.put('settings', { onboarded: '1' });
		await changed();
		step = 5;
	}
</script>

<svelte:head><title>Setup · Hishab</title></svelte:head>

<div class="mx-auto max-w-2xl">
	<h1 class="nb-title mb-4 text-3xl">Setup</h1>
	<ol class="mb-6 flex gap-1">
		{#each steps as s, i (s)}
			<li
				class="flex-1 rounded-[4px] border-2 border-ink py-1 text-center text-[0.65rem] font-extrabold uppercase sm:text-xs"
				style="background:{i + 1 < step ? 'var(--color-green)' : i + 1 === step ? 'var(--color-yellow)' : 'var(--color-bg0h)'}"
			>
				{s}
			</li>
		{/each}
	</ol>

	{#if step === 1}
		<section class="nb-card space-y-4 p-4">
			<div>
				<h2 class="nb-title text-xl">Where is your money right now?</h2>
				<p class="text-sm text-muted">Enter today's balance for each. Hishab starts tracking from here.</p>
			</div>
			{#each rows as r, i (r.key)}
				<div class="grid grid-cols-[2.5rem_1fr_9rem_auto] items-center gap-2">
					<span class="text-2xl">{typeMeta(r.type).icon}</span>
					<input class="nb-input" bind:value={r.name} placeholder={r.type === 'bank' ? 'Bank name e.g. DBBL' : typeMeta(r.type).label} />
					<MoneyInput bind:value={r.balance} />
					<button class="px-1 text-muted hover:text-red-d" aria-label="Remove" onclick={() => rows.splice(i, 1)}>✕</button>
				</div>
			{/each}
			<div class="flex flex-wrap gap-2">
				{#each WALLET_PROVIDERS as p (p.name)}
					<button class="nb-chip bg-bg0h" onclick={() => addRow('wallet', p.name)}>＋ {p.name}</button>
				{/each}
				<button class="nb-chip bg-bg0h" onclick={() => addRow('bank')}>＋ Bank</button>
				<button class="nb-chip bg-bg0h" onclick={() => addRow('savings')}>＋ Savings</button>
				<button class="nb-chip bg-bg0h" onclick={() => addRow('cash')}>＋ Cash</button>
			</div>
			<div class="flex justify-between pt-2">
				<Button onclick={() => (step = 2)}>Skip</Button>
				<Button variant="primary" onclick={saveAccounts} disabled={busy}>Save & next →</Button>
			</div>
		</section>
	{:else if step === 2}
		<section class="nb-card space-y-4 p-4">
			<div>
				<h2 class="nb-title text-xl">Credit cards</h2>
				<p class="text-sm text-muted">Enter how much you owe today and the statement/due days printed on your bill.</p>
			</div>
			{#each cards as c, i (c.key)}
				<div class="nb-flat grid grid-cols-2 gap-3 bg-bg1 p-3 sm:grid-cols-3">
					<Field label="Card name"><input class="nb-input" bind:value={c.name} placeholder="e.g. EBL Visa" /></Field>
					<Field label="Owed now"><MoneyInput bind:value={c.owed} /></Field>
					<Field label="Limit"><MoneyInput bind:value={c.limit} /></Field>
					<Field label="Statement day"><input class="nb-input" type="number" min="1" max="31" bind:value={c.statement} /></Field>
					<Field label="Due day"><input class="nb-input" type="number" min="1" max="31" bind:value={c.due} /></Field>
					<div class="flex items-end"><Button size="sm" onclick={() => cards.splice(i, 1)}>Remove</Button></div>
				</div>
			{/each}
			<Button onclick={() => cards.push({ key: k++, name: '', owed: null, limit: null, statement: null, due: null })}>＋ Add card</Button>
			<div class="flex justify-between pt-2">
				<Button onclick={() => (step = 3)}>{cards.length ? 'Skip' : 'No cards →'}</Button>
				{#if cards.length}<Button variant="primary" onclick={saveCards} disabled={busy}>Save & next →</Button>{/if}
			</div>
		</section>
	{:else if step === 3}
		<section class="nb-card space-y-4 p-4">
			<div>
				<h2 class="nb-title text-xl">Running loans</h2>
				<p class="text-sm text-muted">bKash digital loan, bank loans, anything with EMIs. Choose “Already running” and say how many EMIs you've paid.</p>
			</div>
			{#if loansAdded}<p class="nb-chip bg-green">✓ {loansAdded} loan{loansAdded > 1 ? 's' : ''} added</p>{/if}
			{#if showLoanForm}
				<LoanForm
					onDone={() => {
						loansAdded++;
						showLoanForm = false;
					}}
				/>
			{:else}
				<Button onclick={() => (showLoanForm = true)}>＋ Add a loan</Button>
			{/if}
			<div class="flex justify-end pt-2">
				<Button variant="primary" onclick={() => (step = 4)}>{loansAdded ? 'Next →' : 'No loans →'}</Button>
			</div>
		</section>
	{:else if step === 4}
		<section class="nb-card space-y-4 p-4">
			<div>
				<h2 class="nb-title text-xl">Regular income</h2>
				<p class="text-sm text-muted">These get added automatically every month on the day you choose. Edit or pause anytime in More → Recurring.</p>
			</div>
			<Field label="Lands in account"><AccountSelect bind:value={salaryAccount} /></Field>
			{#each [{ label: '💼 Salary', get: () => salary, set: (v: number | null) => (salary = v), day: () => salaryDay, setDay: (d: number) => (salaryDay = d) }, { label: '📚 Tuition', get: () => tuition, set: (v: number | null) => (tuition = v), day: () => tuitionDay, setDay: (d: number) => (tuitionDay = d) }, { label: '🤲 Family allowance', get: () => allowance, set: (v: number | null) => (allowance = v), day: () => allowanceDay, setDay: (d: number) => (allowanceDay = d) }] as inc (inc.label)}
				<div class="grid grid-cols-[1fr_9rem_5rem] items-end gap-2">
					<span class="pb-2.5 font-bold">{inc.label}</span>
					<Field label="Amount"><MoneyInput bind:value={inc.get, inc.set} /></Field>
					<Field label="Day"><input class="nb-input" type="number" min="1" max="31" bind:value={inc.day, inc.setDay} /></Field>
				</div>
			{/each}
			<div class="flex justify-between pt-2">
				<Button onclick={finish}>Skip</Button>
				<Button variant="primary" onclick={saveIncome} disabled={busy}>Finish ✓</Button>
			</div>
		</section>
	{:else}
		<section class="nb-card space-y-4 bg-green p-6 text-center">
			<div class="text-5xl">🎉</div>
			<h2 class="nb-title text-2xl">You're set!</h2>
			<p class="text-sm">
				{refs.accounts.length} accounts · total {formatBDT(refs.accounts.reduce((s, a) => s + (a.balance ?? 0), 0))}
			</p>
			<p class="text-sm">Next: add your semester fees under Plan → University and set budgets.</p>
			<div class="flex justify-center gap-3">
				<Button href="/plan/uni">Semester fees</Button>
				<Button variant="primary" onclick={() => goto('/')}>Go to dashboard</Button>
			</div>
		</section>
	{/if}

	{#if step < 5}
		<p class="mt-4 text-center text-xs text-muted"><a class="underline" href="/" onclick={() => toast('You can finish setup later from More')}>Skip setup for now</a></p>
	{/if}
</div>
