<script lang="ts">
	import { formatBDT } from '#lib/domain/money';
	import type { TxnType } from '#lib/types';

	let {
		value,
		type,
		sign = false,
		decimals = false,
		class: klass = ''
	}: { value: number; type?: TxnType | 'neutral'; sign?: boolean; decimals?: boolean; class?: string } = $props();

	const color = $derived(
		type === 'income' ? 'text-green-d' : type === 'expense' ? 'text-red-d' : type === 'transfer' ? 'text-blue-d' : value < 0 ? 'text-red-d' : ''
	);
	const shown = $derived(type === 'expense' ? -Math.abs(value) : type === 'income' ? Math.abs(value) : value);
</script>

<span class="money font-bold {color} {klass}">{formatBDT(shown, { sign: sign || type === 'income', decimals })}</span>
