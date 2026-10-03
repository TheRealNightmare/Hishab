<script lang="ts">
	import Sheet from './Sheet.svelte';
	import Segmented from './Segmented.svelte';
	import MoneyInput from './MoneyInput.svelte';
	import AccountSelect from './AccountSelect.svelte';
	import CategoryGrid from './CategoryGrid.svelte';
	import Field from './Field.svelte';
	import Button from './Button.svelte';
	import { api } from '#lib/api';
	import { changed, confirmDialog, lastAccount, quickAdd, refs, rememberAccount, toast } from '#lib/stores.svelte';
	import { today } from '#lib/domain/dates';
	import type { TxnType } from '#lib/types';

	let type = $state<TxnType>('expense');
	let amount = $state<number | null>(null);
	let account_id = $state<string | null>(null);
	let to_account_id = $state<string | null>(null);
	let category_id = $state<string | null>(null);
	let date = $state(today());
	let note = $state('');
	let tagText = $state('');
	let fee = $state<number | null>(null);
	let saving = $state(false);
	let showMore = $state(false);

	const editing = $derived(quickAdd.preset.id);

	// Reset the form each time the sheet opens, applying any preset.
	$effect(() => {
		if (!quickAdd.open) return;
		const p = quickAdd.preset;
		type = p.type ?? 'expense';
		amount = p.amount ?? null;
		const fallback = lastAccount();
		account_id = p.account_id ?? (refs.accounts.some((a) => a.id === fallback && !a.archived) ? fallback : (refs.accounts.find((a) => !a.archived)?.id ?? null));
		to_account_id = p.to_account_id ?? null;
		category_id = p.category_id ?? null;
		date = p.date ?? today();
		note = p.note ?? '';
		tagText = (p.tags ?? []).join(' ');
		fee = p.fee || null;
		showMore = !!(p.note || p.tags?.length || p.fee);
	});

	// Category belongs to a kind; clear it when switching income ↔ expense.
	$effect(() => {
		const c = refs.categories.find((x) => x.id === category_id);
		if (c && c.kind !== type) category_id = null;
	});

	const tags = $derived(
		tagText
			.split(/[\s,]+/)
			.map((t) => t.replace(/^#/, '').trim().toLowerCase())
			.filter(Boolean)
	);
	const valid = $derived(!!amount && amount > 0 && !!account_id && (type !== 'transfer' || (!!to_account_id && to_account_id !== account_id)));

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!valid || saving) return;
		saving = true;
		const body = {
			type,
			amount,
			account_id,
			to_account_id: type === 'transfer' ? to_account_id : null,
			category_id: type === 'transfer' ? null : category_id,
			date,
			note: note.trim() || null,
			tags,
			fee: fee ?? 0,
			goal_id: quickAdd.preset.goal_id ?? null,
			scheme_id: quickAdd.preset.scheme_id ?? null
		};
		try {
			if (editing) await api.put(`transactions/${editing}`, body);
			else await api.post('transactions', body);
			rememberAccount(account_id!);
			toast(editing ? 'Updated' : 'Saved');
			quickAdd.open = false;
			await changed();
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!editing || !(await confirmDialog('Delete this transaction?', 'Balances will be recalculated.'))) return;
		await api.del(`transactions/${editing}`);
		toast('Deleted');
		quickAdd.open = false;
		await changed();
	}

	const typeColors = { expense: 'var(--color-red)', income: 'var(--color-green)', transfer: 'var(--color-blue)' };
</script>

<Sheet bind:open={quickAdd.open} title={quickAdd.preset.title ?? (editing ? 'Edit transaction' : 'Add transaction')}>
	{#if refs.accounts.filter((a) => !a.archived).length === 0}
		<div class="space-y-3 text-center">
			<p class="font-bold">Add an account first: cash, bKash, bank…</p>
			<Button variant="primary" href="/accounts?new=1" onclick={() => (quickAdd.open = false)}>Add account</Button>
		</div>
	{:else}
		<form class="space-y-4" onsubmit={save}>
			{#if !quickAdd.preset.goal_id && !quickAdd.preset.scheme_id}
				<Segmented
					options={[
						{ value: 'expense', label: 'Expense' },
						{ value: 'income', label: 'Income' },
						{ value: 'transfer', label: 'Transfer' }
					]}
					bind:value={type}
					colors={typeColors}
				/>
			{/if}

			<MoneyInput bind:value={amount} big autofocus={!editing} required />

			{#if type === 'transfer'}
				<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
					<Field label="From"><AccountSelect bind:value={account_id} /></Field>
					<span class="pb-2.5 text-xl font-bold">→</span>
					<Field label="To"><AccountSelect bind:value={to_account_id} exclude={account_id} /></Field>
				</div>
			{:else}
				<Field label={type === 'income' ? 'Into account' : 'Paid from'}><AccountSelect bind:value={account_id} /></Field>
				<div>
					<span class="nb-label">Category</span>
					<CategoryGrid bind:value={category_id} kind={type} />
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<Field label="Date"><input type="date" class="nb-input" bind:value={date} required /></Field>
				<Field label="Note"><input class="nb-input" bind:value={note} placeholder="Optional" maxlength="200" /></Field>
			</div>

			{#if showMore}
				<div class="grid grid-cols-2 gap-3">
					<Field label="Tags" hint="Space separated"><input class="nb-input" bind:value={tagText} placeholder="#trip #gift" /></Field>
					{#if type === 'transfer'}
						<Field label="Fee / charge" hint="e.g. bKash cash-out"><MoneyInput bind:value={fee} /></Field>
					{/if}
				</div>
			{:else}
				<button type="button" class="text-xs font-bold tracking-wider uppercase text-blue-d underline" onclick={() => (showMore = true)}
					>+ Tags{type === 'transfer' ? ' & fee' : ''}</button
				>
			{/if}

			<div class="flex gap-3 pt-1">
				{#if editing}
					<Button variant="danger" onclick={remove}>Delete</Button>
				{/if}
				<Button variant="primary" size="lg" class="flex-1" type="submit" disabled={!valid || saving}>
					{saving ? 'Saving…' : editing ? 'Update' : 'Save'}
				</Button>
			</div>
		</form>
	{/if}
</Sheet>
