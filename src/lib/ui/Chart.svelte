<script lang="ts">
	import { Chart, registerables, type ChartConfiguration } from 'chart.js';
	Chart.register(...registerables);

	Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";
	Chart.defaults.font.weight = 'bold';
	Chart.defaults.color = '#3c3836';
	Chart.defaults.borderColor = '#d5c4a1';

	let { config, height = 220 }: { config: ChartConfiguration; height?: number } = $props();
	let canvas: HTMLCanvasElement;

	$effect(() => {
		const chart = new Chart(canvas, $state.snapshot(config) as ChartConfiguration);
		return () => chart.destroy();
	});
</script>

<div style="height:{height}px" class="relative"><canvas bind:this={canvas}></canvas></div>
