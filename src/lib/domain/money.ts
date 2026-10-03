/** Money is stored and passed around as integer paisa (1 ৳ = 100 paisa). */

const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const grouped2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parse user input like "1,25,000.50" or "৳ 500" into paisa. Returns null if not a number. */
export function toPaisa(input: string | number): number | null {
	if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
	const cleaned = input.replace(/[৳,\s]/g, '');
	if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
	const n = Number(cleaned);
	return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function fromPaisa(paisa: number): number {
	return paisa / 100;
}

/** Format paisa as ৳ with Bangladeshi lakh/crore grouping: 12500000 → "৳1,25,000". */
export function formatBDT(paisa: number, opts: { sign?: boolean; decimals?: boolean } = {}): string {
	const abs = Math.abs(paisa) / 100;
	// Whole taka print without decimals; any paisa shows both digits (৳12.50, not ৳12.5).
	const body = (opts.decimals || Math.abs(paisa) % 100 !== 0 ? grouped2 : grouped).format(abs);
	const neg = paisa < 0 ? '−' : opts.sign && paisa > 0 ? '+' : '';
	return `${neg}৳${body}`;
}

/** Compact form for chart axes and tiles: ৳1.2L, ৳3.4Cr, ৳12.5K. */
export function formatCompact(paisa: number): string {
	const v = Math.abs(paisa) / 100;
	const neg = paisa < 0 ? '−' : '';
	if (v >= 1e7) return `${neg}৳${trim(v / 1e7)}Cr`;
	if (v >= 1e5) return `${neg}৳${trim(v / 1e5)}L`;
	if (v >= 1e3) return `${neg}৳${trim(v / 1e3)}K`;
	return `${neg}৳${trim(v)}`;
}

function trim(n: number): string {
	return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '');
}
