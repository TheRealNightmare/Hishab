<script lang="ts" generics="T extends string">
	let {
		options,
		value = $bindable(),
		colors = {}
	}: { options: { value: T; label: string }[]; value: T; colors?: Partial<Record<T, string>> } = $props();
</script>

<div class="nb-flat flex overflow-hidden p-0" role="tablist">
	{#each options as o, i (o.value)}
		<button
			type="button"
			role="tab"
			aria-selected={value === o.value}
			class="flex-1 px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors {i > 0 ? 'border-l-2 border-ink' : ''}"
			style={value === o.value ? `background:${colors[o.value] ?? 'var(--color-yellow)'}` : ''}
			onclick={() => (value = o.value)}>{o.label}</button
		>
	{/each}
</div>
