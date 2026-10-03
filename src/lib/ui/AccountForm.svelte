<script lang="ts">
	import { untrack } from 'svelte';
	import Field from './Field.svelte';
	import MoneyInput from './MoneyInput.svelte';
	import Button from './Button.svelte';
	import { api } from '#lib/api';
	import { changed, confirmDialog, toast } from '#lib/stores.svelte';
	import { ACCOUNT_TYPES, SWATCHES, WALLET_PROVIDERS } from '#lib/meta';
	import type { Account, AccountType } from '#lib/types';

	let { account, onDone }: { account?: Account | null; onDone: () => void } = $props();

	// Card balances are stored negative (owed); the form asks for "amount owed" as a positive number.
	const init = untrack(() => account);
	let name = $state(init?.name ?? '');
	let type = $state<AccountType>(init?.type ?? 'cash');
	let provider = $state(init?.provider ?? '');
	let opening = $state<number | null>(init ? Math.abs(init.opening_balance) : null);
	let creditLimit = $state<number | null>(init?.credit_limit ?? null);
	let statementDay = $state<number | null>(init?.statement_day ?? null);
	let dueDay = $state<number | null>(init?.due_day ?? null);
	let minDuePct = $state<number | null>(init?.min_due_pct ?? 5);
	let color = $state(init?.color ?? '');
	let saving = $state(false);

	$effect(() => {
		if (type === 'wallet' && !provider) provider = 'bKash';
	});

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		const isCard = type === 'card';
		const body = {
			name: name.trim() || provider || ACCOUNT_TYPES.find((t) => t.value === type)!.label,
			type,
			provider: type === 'wallet' || type === 'bank' ? provider || null : null,
			opening_balance: isCard ? -(opening ?? 0) : (opening ?? 0),
			credit_limit: isCard ? creditLimit : null,
			statement_day: isCard ? statementDay : null,
			due_day: isCard ? dueDay : null,
			min_due_pct: isCard ? minDuePct : null,
			color: color || null
		};
		try {
			if (account) await api.put(`accounts/${account.id}`, body);
			else await api.post('accounts', body);
			toast(account ? 'Account updated' : 'Account added');
			await changed();
			onDone();
		} finally {
			saving = false;
		}
	}

	async function archive() {
		if (!account) return;
		await api.put(`accounts/${account.id}`, { archived: account.archived ? 0 : 1 });
		toast(account.archived ? 'Restored' : 'Archived');
		await changed();
		onDone();
	}

	async function remove() {
		if (!account || !(await confirmDialog(`Delete ${account.name}?`, 'Only possible when it has no transactions. Otherwise archive it.'))) return;
		await api.del(`accounts/${account.id}`);
		toast('Deleted');
		await changed();
		onDone();
	}
</script>

<form class="space-y-4" onsubmit={save}>
	<div>
		<span class="nb-label">Type</span>
		<div class="grid grid-cols-5 gap-2">
			{#each ACCOUNT_TYPES as t (t.value)}
				<button
					type="button"
					class="flex flex-col items-center rounded-[4px] border-2 border-ink py-2 text-xs font-bold {type === t.value ? 'shadow-none' : 'shadow-hard-sm'}"
					style="background:{type === t.value ? t.color : 'var(--color-bg0h)'}"
					onclick={() => (type = t.value)}
				>
					<span class="text-xl">{t.icon}</span>{t.label.split(' ')[0]}
				</button>
			{/each}
		</div>
	</div>

	{#if type === 'wallet'}
		<div class="flex flex-wrap gap-2">
			{#each WALLET_PROVIDERS as p (p.name)}
				<button
					type="button"
					class="nb-chip {provider === p.name ? 'text-bg0h' : ''}"
					style={provider === p.name ? `background:${p.color}` : ''}
					onclick={() => {
						provider = p.name;
						if (!color) color = p.color;
					}}>{p.name}</button
				>
			{/each}
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<Field label="Name"><input class="nb-input" bind:value={name} placeholder={type === 'wallet' ? provider : 'e.g. DBBL Savings'} maxlength="60" /></Field>
		{#if type === 'bank'}
			<Field label="Bank"><input class="nb-input" bind:value={provider} placeholder="DBBL, BRAC, City…" /></Field>
		{/if}
		<Field
			label={type === 'card' ? 'Amount owed now' : 'Current balance'}
			hint={account ? 'Opening balance. Transactions are added on top' : 'What it holds today'}
		>
			<MoneyInput bind:value={opening} />
		</Field>
	</div>

	{#if type === 'card'}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<Field label="Credit limit"><MoneyInput bind:value={creditLimit} /></Field>
			<Field label="Statement day"><input class="nb-input" type="number" min="1" max="31" bind:value={statementDay} required /></Field>
			<Field label="Due day"><input class="nb-input" type="number" min="1" max="31" bind:value={dueDay} required /></Field>
			<Field label="Min due %"><input class="nb-input" type="number" min="0" max="100" step="0.5" bind:value={minDuePct} /></Field>
		</div>
	{/if}

	<div>
		<span class="nb-label">Colour</span>
		<div class="flex flex-wrap gap-2">
			{#each SWATCHES as s (s)}
				<button
					type="button"
					class="size-7 rounded-[4px] border-2 border-ink {color === s ? 'outline-3 outline-offset-1 outline-ink' : ''}"
					style="background:{s}"
					aria-label="Colour {s}"
					onclick={() => (color = s)}
				></button>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap gap-3 pt-2">
		{#if account}
			<Button variant="danger" onclick={remove}>Delete</Button>
			<Button onclick={archive}>{account.archived ? 'Restore' : 'Archive'}</Button>
		{/if}
		<Button variant="primary" type="submit" class="flex-1" disabled={saving}>{account ? 'Save' : 'Add account'}</Button>
	</div>
</form>
