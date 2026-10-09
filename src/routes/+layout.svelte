<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount, type Snippet } from 'svelte';
	import QuickAdd from '#lib/ui/QuickAdd.svelte';
	import Toasts from '#lib/ui/Toasts.svelte';
	import Confirm from '#lib/ui/Confirm.svelte';
	import ErrorState from '#lib/ui/ErrorState.svelte';
	import { loadRefs, openQuickAdd, refs } from '#lib/stores.svelte';

	let { children }: { children: Snippet } = $props();

	let refsError = $state(false);
	function start() {
		refsError = false;
		return loadRefs().catch((e) => {
			refsError = true;
			throw e;
		});
	}

	onMount(() => {
		start()
			.then(() => {
				// PWA shortcuts / deep links: /?add=expense|income|transfer opens quick add.
				const add = page.url.searchParams.get('add');
				if (add === 'expense' || add === 'income' || add === 'transfer') {
					openQuickAdd({ type: add });
					history.replaceState(history.state, '', page.url.pathname);
				}
			})
			.catch(() => {});
	});

	const nav = [
		{ href: '/', label: 'Home', icon: '⌂' },
		{ href: '/activity', label: 'Activity', icon: '≡' },
		{ href: '/plan', label: 'Plan', icon: '◷' },
		{ href: '/more', label: 'More', icon: '⋯' }
	];
	const desktopNav = [
		{ href: '/', label: 'Dashboard', icon: '⌂' },
		{ href: '/activity', label: 'Activity', icon: '≡' },
		{ href: '/accounts', label: 'Accounts', icon: '▣' },
		{ href: '/plan/loans', label: 'Loans', icon: '🏦' },
		{ href: '/plan/uni', label: 'University', icon: '🎓' },
		{ href: '/plan/savings', label: 'Savings', icon: '🐖' },
		{ href: '/plan/budgets', label: 'Budgets', icon: '◔' },
		{ href: '/plan/people', label: 'People', icon: '🤝' },
		{ href: '/plan/calendar', label: 'Calendar', icon: '📅' },
		{ href: '/reports', label: 'Reports', icon: '▤' },
		{ href: '/more', label: 'Settings', icon: '⚙' }
	];

	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
	const activeMobile = (href: string) =>
		href === '/plan' ? /^\/(plan|accounts|reports)/.test(page.url.pathname) : active(href);

	function onkeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) {
			e.preventDefault();
			openQuickAdd();
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="mx-auto flex min-h-dvh max-w-6xl">
	<!-- Desktop sidebar -->
	<aside class="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r-2 border-ink bg-bg1 p-4 lg:flex">
		<a href="/" class="mb-5 flex items-center gap-2">
			<span class="nb-press flex size-10 items-center justify-center bg-yellow text-xl font-extrabold">৳</span>
			<span class="nb-title text-2xl">Hishab</span>
		</a>
		{#each desktopNav as n (n.href)}
			<a
				href={n.href}
				class="flex items-center gap-3 rounded-[4px] border-2 px-3 py-2 font-bold {active(n.href)
					? 'border-ink bg-yellow shadow-hard-sm'
					: 'border-transparent hover:border-ink hover:bg-bg0h'}"
			>
				<span class="w-5 text-center">{n.icon}</span>{n.label}
			</a>
		{/each}
		<button class="nb-press mt-auto bg-orange py-3 text-base font-extrabold uppercase" onclick={() => openQuickAdd()}>＋ Add <kbd class="ml-1 text-xs opacity-70">N</kbd></button>
	</aside>

	<main class="min-w-0 flex-1 px-4 pt-5 pb-[calc(6.5rem+var(--safe-bottom))] sm:px-6 lg:px-8 lg:pb-10">
		{#if !refs.loaded && !refsError}
			<div class="flex h-[60dvh] items-center justify-center">
				<div class="nb-card animate-pulse bg-yellow px-6 py-4 text-xl font-extrabold">৳ Loading…</div>
			</div>
		{:else if refsError}
			<div class="flex h-[60dvh] items-center justify-center">
				<ErrorState onretry={start} title="Couldn't reach Hishab" />
			</div>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>

<!-- Mobile bottom bar -->
<nav class="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-bg1 pb-[var(--safe-bottom)] lg:hidden">
	<div class="mx-auto grid max-w-xl grid-cols-5 items-end">
		{#each nav.slice(0, 2) as n (n.href)}
			<a href={n.href} class="flex flex-col items-center py-2 text-[0.7rem] font-bold uppercase {activeMobile(n.href) ? 'text-ink' : 'text-muted'}">
				<span class="mb-0.5 flex h-7 w-11 items-center justify-center rounded-[4px] text-lg {activeMobile(n.href) ? 'border-2 border-ink bg-yellow' : ''}">{n.icon}</span>
				{n.label}
			</a>
		{/each}
		<div class="flex justify-center">
			<button
				class="nb-press -mt-6 flex size-16 items-center justify-center bg-orange text-4xl leading-none font-extrabold"
				onclick={() => openQuickAdd()}
				aria-label="Add transaction">＋</button
			>
		</div>
		{#each nav.slice(2) as n (n.href)}
			<a href={n.href} class="flex flex-col items-center py-2 text-[0.7rem] font-bold uppercase {activeMobile(n.href) ? 'text-ink' : 'text-muted'}">
				<span class="mb-0.5 flex h-7 w-11 items-center justify-center rounded-[4px] text-lg {activeMobile(n.href) ? 'border-2 border-ink bg-yellow' : ''}">{n.icon}</span>
				{n.label}
			</a>
		{/each}
	</div>
</nav>

<QuickAdd />
<Toasts />
<Confirm />
