<script lang="ts">
	import Amount from './Amount.svelte';
	import { accountName, category, openQuickAdd, person } from '#lib/stores.svelte';
	import { formatDate } from '#lib/domain/dates';
	import type { Txn } from '#lib/types';

	let { t, showDate = false }: { t: Txn; showDate?: boolean } = $props();
	const cat = $derived(category(t.category_id));
	const who = $derived(person(t.person_id));
	const title = $derived(
		t.type === 'transfer'
			? `${accountName(t.account_id)} → ${accountName(t.to_account_id)}`
			: who
				? `${t.type === 'expense' ? 'To' : 'From'} ${who.name}`
				: (cat?.name ?? 'Uncategorised')
	);
	const icon = $derived(t.type === 'transfer' ? '⇄' : (cat?.icon ?? '•'));
	const editable = $derived(!t.parent_id && !t.loan_installment_id);
	const subtitle = $derived([showDate ? formatDate(t.date) : null, t.type !== 'transfer' ? accountName(t.account_id) : null, t.note].filter(Boolean).join(' · '));

	function edit() {
		if (!editable) return;
		openQuickAdd({
			id: t.id,
			type: t.type,
			amount: t.amount,
			account_id: t.account_id,
			to_account_id: t.to_account_id ?? undefined,
			category_id: t.category_id ?? undefined,
			date: t.date,
			note: t.note ?? undefined,
			tags: t.tags,
			fee: t.fee,
			goal_id: t.goal_id ?? undefined,
			scheme_id: t.scheme_id ?? undefined,
			person_id: t.person_id ?? undefined,
			title: who ? `${t.type === 'expense' ? 'Lent / paid back' : 'Borrowed / got back'} · ${who.name}` : undefined
		});
	}
</script>

<button type="button" class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-bg1 {editable ? 'cursor-pointer' : 'cursor-default'}" onclick={edit}>
	<span
		class="flex size-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-ink text-lg"
		style="background:{t.type === 'transfer' ? 'var(--color-blue)' : (cat?.color ?? 'var(--color-bg1)')}">{icon}</span
	>
	<span class="min-w-0 flex-1">
		<span class="block truncate font-bold">{title}</span>
		<span class="block truncate text-xs text-muted">
			{subtitle}
			{#each t.tags as tag (tag)}<span class="ml-1 text-purple-d">#{tag}</span>{/each}
		</span>
	</span>
	<Amount value={t.amount} type={t.type} />
</button>
