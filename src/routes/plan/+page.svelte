<script lang="ts">
	const items = [
		{ href: '/accounts', icon: '💼', title: 'Accounts & cards', desc: 'Balances, card statements, bill payments', bg: 'var(--color-yellow)' },
		{ href: '/plan/loans', icon: '🏦', title: 'Loans', desc: 'bKash loan & other EMIs, schedules', bg: 'var(--color-orange)' },
		{ href: '/plan/uni', icon: '🎓', title: 'University', desc: 'Semester fees & per-semester cost', bg: 'var(--color-blue)' },
		{ href: '/plan/savings', icon: '🐖', title: 'Savings', desc: 'Goals, DPS & FDR', bg: 'var(--color-aqua)' },
		{ href: '/plan/budgets', icon: '◔', title: 'Budgets', desc: 'Monthly limits per category', bg: 'var(--color-purple)' },
		{ href: '/plan/people', icon: '🤝', title: 'People', desc: 'Money you lent or borrowed', bg: 'var(--color-green)' },
		{ href: '/plan/calendar', icon: '📅', title: 'Calendar', desc: 'EMIs, bills, fees & recurring by day', bg: 'var(--color-red)' },
		{ href: '/reports', icon: '▤', title: 'Reports', desc: 'Trends, insights & cost per semester', bg: 'var(--color-bg2)' }
	];
</script>

<svelte:head><title>Plan · Hishab</title></svelte:head>

<h1 class="nb-title mb-4 text-3xl">Plan</h1>
<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
	{#each items as i (i.href)}
		<a href={i.href} class="nb-press flex items-center gap-4 bg-bg0h p-4">
			<span class="flex size-12 shrink-0 items-center justify-center rounded-[4px] border-2 border-ink text-2xl" style="background:{i.bg}">{i.icon}</span>
			<span class="min-w-0">
				<span class="block text-lg font-extrabold">{i.title}</span>
				<span class="block text-sm text-muted">{i.desc}</span>
			</span>
		</a>
	{/each}
</div>
