<script lang="ts">
	let { value, max, color, warn = true }: { value: number; max: number; color?: string; warn?: boolean } = $props();
	const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);
	const fill = $derived(
		color ?? (!warn ? 'var(--color-aqua)' : value > max ? 'var(--color-red)' : pct >= 80 ? 'var(--color-yellow)' : 'var(--color-green)')
	);
</script>

<div class="h-4 w-full overflow-hidden rounded-[4px] border-2 border-ink bg-bg1" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
	<div class="h-full border-r-2 border-ink transition-[width] duration-500" class:border-r-0={pct === 0} style="width:{pct}%;background:{fill};background-image:repeating-linear-gradient(-45deg,transparent 0 6px,rgba(40,40,40,.12) 6px 9px)"></div>
</div>
