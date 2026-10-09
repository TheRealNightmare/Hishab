<script lang="ts">
	/** Placeholder blocks while a page loads. `rows` stacks list-like bars under an optional hero. */
	let { rows = 4, hero = true }: { rows?: number; hero?: boolean } = $props();
</script>

<div class="space-y-3" aria-busy="true" aria-label="Loading">
	{#if hero}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="nb-skeleton col-span-2 h-24"></div>
			<div class="nb-skeleton h-24"></div>
			<div class="nb-skeleton h-24"></div>
		</div>
	{/if}
	<div class="nb-flat divide-y divide-dashed divide-bg3 overflow-hidden">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<div class="flex items-center gap-3 px-3 py-3">
				<div class="nb-skeleton size-9 shrink-0"></div>
				<div class="flex-1 space-y-1.5">
					<div class="nb-skeleton h-3 w-2/5"></div>
					<div class="nb-skeleton h-2.5 w-3/5"></div>
				</div>
				<div class="nb-skeleton h-4 w-16"></div>
			</div>
		{/each}
	</div>
</div>
