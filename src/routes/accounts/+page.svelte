<script lang="ts">
	import { page } from '$app/state';
	import { refs } from '#lib/stores.svelte';
	import { formatBDT } from '#lib/domain/money';
	import { ACCOUNT_TYPES } from '#lib/meta';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import AccountForm from '#lib/ui/AccountForm.svelte';
	import Empty from '#lib/ui/Empty.svelte';

	let adding = $state(page.url.searchParams.get('new') === '1');
	let showArchived = $state(false);

	const groups = $derived(
		ACCOUNT_TYPES.map((t) => {
			const list = refs.accounts.filter((a) => a.type === t.value && (showArchived || !a.archived));
			return { ...t, list, total: list.filter((a) => !a.archived).reduce((s, a) => s + (a.balance ?? 0), 0) };
		}).filter((g) => g.list.length)
	);
	const total = $derived(refs.accounts.filter((a) => !a.archived).reduce((s, a) => s + (a.balance ?? 0), 0));
</script>

<svelte:head><title>Accounts · Hishab</title></svelte:head>

<PageHeader title="Accounts" sub="Total across accounts: {formatBDT(total)}">
	{#snippet actions()}<Button variant="primary" onclick={() => (adding = true)}>＋ New</Button>{/snippet}
</PageHeader>

{#if groups.length === 0}
	<Empty icon="💼" title="No accounts yet">Add your cash wallet, bKash, bank accounts and credit cards.</Empty>
{/if}

<div class="space-y-6">
	{#each groups as g (g.value)}
		<section>
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="nb-title text-xl">{g.icon} {g.label}</h2>
				<span class="money text-sm font-bold">{formatBDT(g.total)}</span>
			</div>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each g.list as a (a.id)}
					<a href="/accounts/{a.id}" class="nb-press flex items-center gap-3 bg-bg0h p-3 {a.archived ? 'opacity-50' : ''}">
						<span class="size-10 shrink-0 rounded-[4px] border-2 border-ink" style="background:{a.color ?? g.color}"></span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-bold">{a.name}{a.archived ? ' (archived)' : ''}</span>
							<span class="block text-xs text-muted">
								{a.provider ?? g.label}{a.type === 'card' && a.due_day ? ` · due on ${a.due_day}` : ''}
							</span>
						</span>
						<span class="money font-extrabold {(a.balance ?? 0) < 0 ? 'text-red-d' : ''}">{formatBDT(a.balance ?? 0)}</span>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</div>

{#if refs.accounts.some((a) => a.archived)}
	<button class="mt-6 text-xs font-bold tracking-wider uppercase underline" onclick={() => (showArchived = !showArchived)}>
		{showArchived ? 'Hide' : 'Show'} archived
	</button>
{/if}

<Sheet bind:open={adding} title="New account">
	{#if adding}<AccountForm onDone={() => (adding = false)} />{/if}
</Sheet>
