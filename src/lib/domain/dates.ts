/** Date helpers working on ISO 'YYYY-MM-DD' strings in local time (Asia/Dhaka for the user). */

export function today(): string {
	return toISO(new Date());
}

export function toISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function daysInMonth(year: number, month0: number): number {
	return new Date(year, month0 + 1, 0).getDate();
}

/** Build a date for a given day-of-month, clamped to the month length (31 → 28/29/30). */
export function clampDay(year: number, month0: number, day: number): string {
	const norm = new Date(year, month0, 1);
	const d = Math.min(day, daysInMonth(norm.getFullYear(), norm.getMonth()));
	return toISO(new Date(norm.getFullYear(), norm.getMonth(), d));
}

/** Add months keeping the day-of-month anchored (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: string, n: number, anchorDay?: number): string {
	const d = parseISO(iso);
	return clampDay(d.getFullYear(), d.getMonth() + n, anchorDay ?? d.getDate());
}

export function addDays(iso: string, n: number): string {
	const d = parseISO(iso);
	d.setDate(d.getDate() + n);
	return toISO(d);
}

export function diffDays(a: string, b: string): number {
	return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

export function monthKey(iso: string): string {
	return iso.slice(0, 7);
}

export function monthRange(key: string): { from: string; to: string } {
	const [y, m] = key.split('-').map(Number);
	return { from: `${key}-01`, to: clampDay(y, m - 1, 31) };
}

export function formatDate(iso: string, style: 'short' | 'long' = 'short'): string {
	return parseISO(iso).toLocaleDateString('en-GB', style === 'short' ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMonth(key: string): string {
	return parseISO(`${key}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function relativeDays(iso: string, from = today()): string {
	const n = diffDays(iso, from);
	if (n === 0) return 'today';
	if (n === 1) return 'tomorrow';
	if (n === -1) return 'yesterday';
	return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
