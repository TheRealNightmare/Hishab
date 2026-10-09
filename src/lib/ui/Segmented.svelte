<script lang="ts" generics="T extends string">
	let {
		options,
		value = $bindable(),
		colors = {},
		compact = false
	}: { options: { value: T; label: string }[]; value: T; colors?: Partial<Record<T, string>>; compact?: boolean } = $props();
</script>

<div class="nb-flat flex overflow-hidden p-0" role="tablist">
	{#each options as o, i (o.value)}
		<button
			type="button"
			role="tab"
			aria-selected={value === o.value}
			class="min-w-0 flex-1 truncate py-2 font-bold uppercase tracking-wide transition-colors {compact ? 'px-1 text-xs' : 'px-3 text-sm'} {i > 0 ? 'border-l-2 border-ink' : ''}"
			style={value === o.value ? `background:${colors[o.value] ?? 'var(--color-yellow)'}` : ''}
			onclick={() => (value = o.value)}>{o.label}</button
		>
	{/each}
</div>
