<script lang="ts">
	import { page } from '$app/state';
	import { api, qs } from '#lib/api';
	import { loader } from '#lib/load.svelte';
	import { debtCategory, openQuickAdd, person } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import PersonForm from '#lib/ui/PersonForm.svelte';
	import TxnRow from '#lib/ui/TxnRow.svelte';
	import Empty from '#lib/ui/Empty.svelte';
	import Skeleton from '#lib/ui/Skeleton.svelte';
	import type { Txn } from '#lib/types';

	const id = $derived(page.params.id!);
	const p = $derived(person(id));
	const balance = $derived(p?.balance ?? 0);
	const txns = loader(() => api.get<Txn[]>(`transactions${qs({ person: id, limit: 300 })}`));
	let editing = $state(false);

	/** Money out (lend, pay back) is a debt expense; money in (borrow, get back) is a debt income. */
	function record(kind: 'expense' | 'income', title: string, amount?: number) {
		openQuickAdd({ type: kind, category_id: debtCategory(kind)?.id, person_id: id, amount, title });
	}
</script>

<svelte:head><title>{p?.name ?? 'Person'} · Hishab</title></svelte:head>

{#if !p}
	<Empty icon="❓" title="Person not found"><a class="underline" href="/plan/people">Back to people</a></Empty>
{:else}
	<PageHeader title={p.name} back="/plan/people" sub={[p.phone, p.note].filter(Boolean).join(' · ') || undefined}>
		{#snippet actions()}<Button onclick={() => (editing = true)}>Edit</Button>{/snippet}
	</PageHeader>

	<section
		class="nb-card p-4 {balance === 0 ? '' : balance > 0 ? 'bg-green' : 'bg-red text-bg0h'}"
		style={balance === 0 ? 'background:var(--color-bg1)' : undefined}
	>
		<div class="text-[0.7rem] font-bold tracking-wider uppercase opacity-80">
			{balance > 0 ? `${p.name} owes you` : balance < 0 ? `You owe ${p.name}` : 'Balance'}
		</div>
		<div class="money mt-1 truncate text-3xl font-extrabold sm:text-4xl">{balance === 0 ? 'All settled ✓' : formatBDT(Math.abs(balance))}</div>
		{#if balance !== 0}
			<div class="mt-3">
				<Button
					variant="default"
					onclick={() => (balance > 0 ? record('income', `Got back from ${p.name}`, balance) : record('expense', `Paid back ${p.name}`, -balance))}
				>
					✓ Settle up
				</Button>
			</div>
		{/if}
	</section>

	<section class="mt-4 grid grid-cols-2 gap-3">
		<Button class="flex-col !gap-0 py-3" onclick={() => record('expense', `Lend to ${p.name}`)}>
			<span class="text-lg">↗</span><span>Lend</span>
		</Button>
		<Button class="flex-col !gap-0 py-3" onclick={() => record('income', `Got back from ${p.name}`)}>
			<span class="text-lg">↙</span><span>Got back</span>
		</Button>
		<Button class="flex-col !gap-0 py-3" onclick={() => record('income', `Borrow from ${p.name}`)}>
			<span class="text-lg">↙</span><span>Borrow</span>
		</Button>
		<Button class="flex-col !gap-0 py-3" onclick={() => record('expense', `Paid back ${p.name}`)}>
			<span class="text-lg">↗</span><span>Paid back</span>
		</Button>
	</section>
	<p class="mt-2 text-xs text-muted">These move your account balances but aren't counted as income or spending. What's owed is included in your net worth.</p>

	<section class="mt-6">
		<h2 class="nb-title mb-2 text-xl">History</h2>
		{#if !txns.value}
			<Skeleton hero={false} rows={3} />
		{:else if txns.value.length === 0}
			<Empty icon="🧾" title="No entries yet" />
		{:else}
			<div class="nb-card divide-y divide-dashed divide-bg3 overflow-hidden">
				{#each txns.value as t (t.id)}<TxnRow {t} showDate />{/each}
			</div>
		{/if}
	</section>

	<Sheet bind:open={editing} title="Edit person">
		{#if editing}<PersonForm person={p} onDone={() => (editing = false)} />{/if}
	</Sheet>
{/if}
