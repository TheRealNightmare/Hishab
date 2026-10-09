<script lang="ts">
	import Sheet from './Sheet.svelte';
	import Segmented from './Segmented.svelte';
	import MoneyInput from './MoneyInput.svelte';
	import AccountSelect from './AccountSelect.svelte';
	import CategoryGrid from './CategoryGrid.svelte';
	import Field from './Field.svelte';
	import Button from './Button.svelte';
	import { api } from '#lib/api';
	import { accountName, category, changed, confirmDialog, data, haptic, lastAccount, openQuickAdd, person, quickAdd, refs, rememberAccount, toast } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { today } from '#lib/domain/dates';
	import type { Favourite, TxnType } from '#lib/types';

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
	// Goal, DPS and lend/borrow entries come with a fixed type and category from their own screens.
	const locked = $derived(!!(quickAdd.preset.goal_id || quickAdd.preset.scheme_id || quickAdd.preset.person_id));

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

	/* Favourites: fetched when the sheet opens, re-fetched only after data changes. */
	let favs = $state<Favourite[]>([]);
	let favVersion = -1;
	const showFavs = $derived(!editing && !locked && type !== 'transfer' && favs.length > 0);
	$effect(() => {
		if (!quickAdd.open || favVersion === data.version) return;
		favVersion = data.version;
		api.get<Favourite[]>('transactions/favourites').then((f) => (favs = f)).catch(() => {});
	});

	function applyFav(f: Favourite) {
		type = f.type;
		amount = f.amount;
		account_id = f.account_id;
		category_id = f.category_id;
		note = f.note ?? '';
		haptic();
	}

	// Long-press a favourite to save it straight away.
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let longPressed = false;
	function favDown(f: Favourite) {
		longPressed = false;
		pressTimer = setTimeout(() => {
			longPressed = true;
			applyFav(f);
			haptic(25);
			void submit();
		}, 550);
	}
	function favUp(f: Favourite) {
		clearTimeout(pressTimer);
		if (!longPressed) applyFav(f);
	}

	const personName = $derived(person(quickAdd.preset.person_id)?.name);

	const tags = $derived(
		tagText
			.split(/[\s,]+/)
			.map((t) => t.replace(/^#/, '').trim().toLowerCase())
			.filter(Boolean)
	);
	const valid = $derived(!!amount && amount > 0 && !!account_id && (type !== 'transfer' || (!!to_account_id && to_account_id !== account_id)));

	async function submit() {
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
			scheme_id: quickAdd.preset.scheme_id ?? null,
			person_id: quickAdd.preset.person_id ?? null
		};
		try {
			if (editing) await api.put(`transactions/${editing}`, body);
			else await api.post('transactions', body);
			rememberAccount(account_id!);
			haptic();
			toast(editing ? 'Updated' : `Saved ${formatBDT(amount!)}`);
			quickAdd.open = false;
			await changed();
		} finally {
			saving = false;
		}
	}

	function save(e: SubmitEvent) {
		e.preventDefault();
		void submit();
	}

	async function remove() {
		if (!editing || !(await confirmDialog('Delete this transaction?', 'Balances will be recalculated.'))) return;
		await api.del(`transactions/${editing}`);
		toast('Deleted');
		quickAdd.open = false;
		await changed();
	}

	function duplicate() {
		const { id: _, ...rest } = quickAdd.preset;
		openQuickAdd({
			...rest,
			type,
			amount: amount ?? undefined,
			account_id: account_id ?? undefined,
			category_id: category_id ?? undefined,
			to_account_id: to_account_id ?? undefined,
			note: note || undefined,
			tags,
			fee: fee ?? undefined,
			date: today(),
			title: 'Duplicate'
		});
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
			{#if !locked}
				<Segmented
					options={[
						{ value: 'expense', label: 'Expense' },
						{ value: 'income', label: 'Income' },
						{ value: 'transfer', label: 'Transfer' }
					]}
					bind:value={type}
					colors={typeColors}
				/>
			{:else if quickAdd.preset.person_id}
				<div class="nb-flat flex items-center gap-2 bg-bg1 px-3 py-2 text-sm font-bold">
					<span class="text-lg">🤝</span>
					<span class="min-w-0 flex-1 truncate">{type === 'expense' ? 'Money out to' : 'Money in from'} {personName ?? '…'}</span>
				</div>
			{/if}

			{#if showFavs}
				<div>
					<span class="nb-label">Quick add <span class="font-normal normal-case tracking-normal text-muted">· tap to fill, hold to save</span></span>
					<div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
						{#each favs as f (f.type + f.category_id + f.account_id + f.amount + f.note)}
							{@const c = category(f.category_id)}
							<button
								type="button"
								class="nb-chip shrink-0 bg-bg0h whitespace-nowrap select-none [-webkit-touch-callout:none]"
								onpointerdown={() => favDown(f)}
								onpointerup={() => favUp(f)}
								onpointerleave={() => clearTimeout(pressTimer)}
								oncontextmenu={(e) => e.preventDefault()}
							>
								<span>{c?.icon ?? '•'}</span>
								<span class="money {f.type === 'income' ? 'text-green-d' : ''}">{formatBDT(f.amount)}</span>
								<span class="max-w-28 truncate font-normal text-muted">{f.note || accountName(f.account_id)}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<MoneyInput bind:value={amount} big autofocus={!editing} required />

			{#if type === 'transfer'}
				<div class="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
					<Field label="From"><AccountSelect bind:value={account_id} /></Field>
					<span class="text-center text-xl font-bold sm:pb-2.5"><span class="sm:hidden">↓</span><span class="hidden sm:inline">→</span></span>
					<Field label="To"><AccountSelect bind:value={to_account_id} exclude={account_id} /></Field>
				</div>
			{:else}
				<Field label={type === 'income' ? 'Into account' : 'Paid from'}><AccountSelect bind:value={account_id} /></Field>
				{#if !quickAdd.preset.person_id}
					<div>
						<span class="nb-label">Category</span>
						<CategoryGrid bind:value={category_id} kind={type} />
					</div>
				{/if}
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<Field label="Date"><input type="date" class="nb-input" bind:value={date} required /></Field>
				<Field label="Note"><input class="nb-input" bind:value={note} placeholder="Optional" maxlength="200" /></Field>
			</div>

			{#if showMore}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<Field label="Tags" hint="Space separated"><input class="nb-input" bind:value={tagText} placeholder="#trip #gift" /></Field>
					{#if type === 'transfer'}
						<Field label="Fee / charge" hint="e.g. bKash cash-out"><MoneyInput bind:value={fee} /></Field>
					{/if}
				</div>
			{:else}
				<button type="button" class="py-1 text-xs font-bold tracking-wider uppercase text-blue-d underline" onclick={() => (showMore = true)}
					>+ Tags{type === 'transfer' ? ' & fee' : ''}</button
				>
			{/if}

			<div class="sticky bottom-0 -mx-4 flex gap-2 border-t-2 border-dashed border-bg3 bg-bg px-4 pt-3 pb-4 sm:static sm:mx-0 sm:border-0 sm:p-0 sm:pt-1">
				{#if editing}
					<Button variant="danger" onclick={remove} aria-label="Delete">🗑<span class="hidden sm:inline">Delete</span></Button>
					<Button onclick={duplicate} aria-label="Duplicate">⧉<span class="hidden sm:inline">Duplicate</span></Button>
				{/if}
				<Button variant="primary" size="lg" class="flex-1" type="submit" disabled={!valid || saving}>
					{saving ? 'Saving…' : editing ? 'Update' : 'Save'}
				</Button>
			</div>
		</form>
	{/if}
</Sheet>
