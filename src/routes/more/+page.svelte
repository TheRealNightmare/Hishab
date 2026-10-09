<script lang="ts">
	import { api } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { accountName, category, changed, confirmDialog, lastAccount, refs, toast } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { formatDate, today } from '#lib/domain/dates';
	import { SWATCHES, isBookkeeping } from '#lib/meta';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Field from '#lib/ui/Field.svelte';
	import MoneyInput from '#lib/ui/MoneyInput.svelte';
	import AccountSelect from '#lib/ui/AccountSelect.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import type { Category, Recurring, TxnType } from '#lib/types';

	const settings = loader(() => api.get<Record<string, string>>('settings'));
	const recurring = loader(() => api.get<Recurring[]>('recurring'));

	/* Settings */
	let dueWindow = $state(30);
	$effect(() => {
		if (settings.value) dueWindow = Number(settings.value.due_window_days ?? 30);
	});
	async function saveSettings() {
		await api.put('settings', { due_window_days: String(dueWindow) });
		toast('Saved');
	}

	/* Categories */
	let catKind = $state<'expense' | 'income'>('expense');
	let catOpen = $state(false);
	let catEdit = $state<Category | null>(null);
	let cName = $state('');
	let cIcon = $state('');
	let cColor = $state(SWATCHES[0]);
	let cParent = $state<string | null>(null);
	const cats = $derived(refs.categories.filter((c) => c.kind === catKind && !isBookkeeping(c)));

	function openCat(c: Category | null) {
		catEdit = c;
		cName = c?.name ?? '';
		cIcon = c?.icon ?? '';
		cColor = c?.color ?? SWATCHES[0];
		cParent = c?.parent_id ?? null;
		catOpen = true;
	}
	async function saveCat(e: SubmitEvent) {
		e.preventDefault();
		const body = { name: cName, icon: cIcon || null, color: cColor, kind: catKind, parent_id: cParent };
		if (catEdit) await api.put(`categories/${catEdit.id}`, body);
		else await api.post('categories', body);
		catOpen = false;
		toast('Category saved');
		await changed();
	}
	async function archiveCat() {
		if (!catEdit) return;
		await api.put(`categories/${catEdit.id}`, { archived: catEdit.archived ? 0 : 1 });
		catOpen = false;
		await changed();
	}
	async function deleteCat() {
		if (!catEdit || !(await confirmDialog(`Delete “${catEdit.name}”?`, 'Past transactions become Uncategorised. Archive instead to keep them.'))) return;
		await api.del(`categories/${catEdit.id}`);
		catOpen = false;
		await changed();
	}

	/* Recurring */
	let recOpen = $state(false);
	let recEdit = $state<Recurring | null>(null);
	let rName = $state('');
	let rType = $state<TxnType>('income');
	let rAmount = $state<number | null>(null);
	let rAccount = $state<string | null>(null);
	let rTo = $state<string | null>(null);
	let rCat = $state<string | null>(null);
	let rFreq = $state<'monthly' | 'weekly'>('monthly');
	let rNext = $state(today());

	function openRec(r: Recurring | null) {
		recEdit = r;
		rName = r?.name ?? '';
		rType = r?.template.type ?? 'income';
		rAmount = r?.template.amount ?? null;
		rAccount = r?.template.account_id ?? lastAccount();
		rTo = r?.template.to_account_id ?? null;
		rCat = r?.template.category_id ?? null;
		rFreq = r?.freq ?? 'monthly';
		rNext = r?.next_date ?? today();
		recOpen = true;
	}
	async function saveRec(e: SubmitEvent) {
		e.preventDefault();
		const body = {
			name: rName,
			freq: rFreq,
			day: rFreq === 'monthly' ? Number(rNext.slice(8)) : null,
			next_date: rNext,
			template: {
				type: rType,
				amount: rAmount,
				account_id: rAccount,
				to_account_id: rType === 'transfer' ? rTo : null,
				category_id: rType === 'transfer' ? null : rCat
			}
		};
		if (recEdit) await api.put(`recurring/${recEdit.id}`, body);
		else await api.post('recurring', body);
		recOpen = false;
		toast('Saved. Entries are created automatically on their dates');
		await changed();
	}
	async function toggleRec(r: Recurring) {
		await api.put(`recurring/${r.id}`, { active: r.active ? 0 : 1 });
		await changed();
	}
	async function deleteRec() {
		if (!recEdit || !(await confirmDialog(`Delete “${recEdit.name}”?`, 'Already-created transactions stay.'))) return;
		await api.del(`recurring/${recEdit.id}`);
		recOpen = false;
		await changed();
	}

	/* Backup */
	let fileInput: HTMLInputElement;
	async function importFile() {
		const f = fileInput.files?.[0];
		if (!f) return;
		let payload: unknown;
		try {
			payload = JSON.parse(await f.text());
		} catch {
			toast('That file is not valid JSON', 'error');
			return;
		}
		if (!(await confirmDialog('Replace ALL data with this backup?', 'Everything currently in Hishab will be overwritten. Export a backup first if unsure.'))) return;
		const r = await api.post<{ imported: number }>('import', payload);
		toast(`Restored ${r.imported} rows`);
		await changed();
		fileInput.value = '';
	}
</script>

<svelte:head><title>More · Hishab</title></svelte:head>

<PageHeader title="More" />

<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
	<a href="/reports" class="nb-press bg-yellow p-3 font-extrabold">▤ Reports</a>
	<a href="/accounts" class="nb-press bg-bg0h p-3 font-extrabold">▣ Accounts</a>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<!-- Categories -->
	<section>
		<div class="mb-2 flex items-center justify-between">
			<h2 class="nb-title text-xl">Categories</h2>
			<Button size="sm" variant="primary" onclick={() => openCat(null)}>＋ Category</Button>
		</div>
		<div class="mb-3">
			<Segmented
				options={[
					{ value: 'expense', label: 'Expense' },
					{ value: 'income', label: 'Income' }
				]}
				bind:value={catKind}
			/>
		</div>
		<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
			{#each cats.filter((c) => !c.parent_id) as c (c.id)}
				<button class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg1 {c.archived ? 'opacity-50' : ''}" onclick={() => openCat(c)}>
					<span class="flex size-8 items-center justify-center rounded-[4px] border-2 border-ink" style="background:{c.color}">{c.icon}</span>
					<span class="flex-1 font-bold">{c.name}{c.archived ? ' (archived)' : ''}</span>
					{#if c.system}<span class="nb-chip text-[0.6rem]">built-in</span>{/if}
				</button>
				{#each cats.filter((s) => s.parent_id === c.id) as s (s.id)}
					<button class="flex w-full items-center gap-3 py-2 pr-3 pl-10 text-left text-sm hover:bg-bg1 {s.archived ? 'opacity-50' : ''}" onclick={() => openCat(s)}>
						<span>{s.icon ?? '↳'}</span><span class="flex-1 font-bold">{s.name}</span>
					</button>
				{/each}
			{/each}
		</div>
	</section>

	<div class="space-y-6">
		<!-- Recurring -->
		<section id="recurring" class="scroll-mt-4">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="nb-title text-xl">Recurring</h2>
				<Button size="sm" variant="primary" onclick={() => openRec(null)}>＋ Rule</Button>
			</div>
			<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
				{#each recurring.value ?? [] as r (r.id)}
					<div class="flex items-center gap-3 px-3 py-2.5 {r.active ? '' : 'opacity-50'}">
						<button class="min-w-0 flex-1 text-left" onclick={() => openRec(r)}>
							<div class="truncate font-bold">{r.name}</div>
							<div class="truncate text-xs text-muted">
								{r.freq} · next {formatDate(r.next_date)} · {r.template.type === 'transfer'
									? `${accountName(r.template.account_id)} → ${accountName(r.template.to_account_id)}`
									: `${category(r.template.category_id)?.name ?? ''} · ${accountName(r.template.account_id)}`}
							</div>
						</button>
						<span class="money font-bold {r.template.type === 'income' ? 'text-green-d' : r.template.type === 'expense' ? 'text-red-d' : 'text-blue-d'}"
							>{formatBDT(r.template.amount)}</span
						>
						<Button size="sm" onclick={() => toggleRec(r)}>{r.active ? 'Pause' : 'Resume'}</Button>
					</div>
				{:else}
					<p class="p-4 text-sm text-muted">Salary, tuition, rent, subscriptions and DPS can all be added automatically each month.</p>
				{/each}
			</div>
		</section>

		<!-- Preferences -->
		<section class="nb-card p-4">
			<h2 class="nb-title mb-3 text-xl">Preferences</h2>
			<div class="flex items-end gap-3">
				<Field label="Show dues within (days)" class="flex-1"><input class="nb-input" type="number" min="1" max="120" bind:value={dueWindow} /></Field>
				<Button onclick={saveSettings}>Save</Button>
			</div>
			<div class="mt-3"><Button href="/more/setup" size="sm">Run setup wizard again</Button></div>
		</section>

		<!-- Backup -->
		<section class="nb-card p-4">
			<h2 class="nb-title mb-1 text-xl">Backup & export</h2>
			<p class="mb-3 text-sm text-muted">Your data lives in Cloudflare D1. Download a copy now and then.</p>
			<div class="flex flex-wrap gap-2">
				<Button href="/api/export" variant="primary" download data-sveltekit-reload>⬇ JSON backup</Button>
				<Button href="/api/export?format=csv" download data-sveltekit-reload>⬇ Transactions CSV</Button>
				<Button onclick={() => fileInput.click()}>⬆ Restore backup</Button>
				<input type="file" accept="application/json,.json" class="hidden" bind:this={fileInput} onchange={importFile} />
			</div>
		</section>
	</div>
</div>

<Sheet bind:open={catOpen} title={catEdit ? 'Edit category' : 'New category'}>
	<form class="space-y-4" onsubmit={saveCat}>
		<div class="grid grid-cols-[5rem_1fr] gap-3">
			<Field label="Icon"><input class="nb-input text-center text-xl" bind:value={cIcon} maxlength="4" placeholder="🙂" /></Field>
			<Field label="Name"><input class="nb-input" bind:value={cName} required maxlength="40" /></Field>
		</div>
		<Field label="Parent (optional)" hint="Subcategories roll up into the parent in reports and budgets">
			<select class="nb-input" bind:value={cParent}>
				<option value={null}>None</option>
				{#each cats.filter((c) => !c.parent_id && c.id !== catEdit?.id) as c (c.id)}<option value={c.id}>{c.icon} {c.name}</option>{/each}
			</select>
		</Field>
		<div class="flex flex-wrap gap-2">
			{#each SWATCHES as s (s)}
				<button type="button" aria-label="Colour {s}" class="size-7 rounded-[4px] border-2 border-ink {cColor === s ? 'outline-3 outline-offset-1 outline-ink' : ''}" style="background:{s}" onclick={() => (cColor = s)}></button>
			{/each}
		</div>
		<div class="flex flex-wrap gap-3">
			{#if catEdit && !catEdit.system}<Button variant="danger" onclick={deleteCat}>Delete</Button>{/if}
			{#if catEdit}<Button onclick={archiveCat}>{catEdit.archived ? 'Restore' : 'Archive'}</Button>{/if}
			<Button variant="primary" type="submit" class="flex-1">Save</Button>
		</div>
	</form>
</Sheet>

<Sheet bind:open={recOpen} title={recEdit ? 'Edit recurring' : 'New recurring'}>
	<form class="space-y-4" onsubmit={saveRec}>
		<Segmented
			options={[
				{ value: 'income', label: 'Income' },
				{ value: 'expense', label: 'Expense' },
				{ value: 'transfer', label: 'Transfer' }
			]}
			bind:value={rType}
		/>
		<div class="grid grid-cols-2 gap-3">
			<Field label="Name" class="col-span-2"><input class="nb-input" bind:value={rName} placeholder="e.g. Salary, Netflix, Tuition" required /></Field>
			<Field label="Amount"><MoneyInput bind:value={rAmount} required /></Field>
			<Field label="Frequency">
				<select class="nb-input" bind:value={rFreq}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select>
			</Field>
			<Field label={rType === 'transfer' ? 'From' : rType === 'income' ? 'Into' : 'Paid from'}><AccountSelect bind:value={rAccount} /></Field>
			{#if rType === 'transfer'}
				<Field label="To"><AccountSelect bind:value={rTo} exclude={rAccount} /></Field>
			{:else}
				<Field label="Category">
					<select class="nb-input" bind:value={rCat}>
						<option value={null}>—</option>
						{#each refs.categories.filter((c) => c.kind === rType && !c.archived && !isBookkeeping(c)) as c (c.id)}<option value={c.id}>{c.icon} {c.name}</option>{/each}
					</select>
				</Field>
			{/if}
			<Field label="Next date" hint="Monthly rules repeat on this day"><input class="nb-input" type="date" bind:value={rNext} required /></Field>
		</div>
		<div class="flex gap-3">
			{#if recEdit}<Button variant="danger" onclick={deleteRec}>Delete</Button>{/if}
			<Button variant="primary" type="submit" class="flex-1" disabled={!rAmount || !rAccount || (rType === 'transfer' && !rTo)}>Save</Button>
		</div>
	</form>
</Sheet>
