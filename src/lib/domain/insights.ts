import { addDays, diffDays } from './dates';

export interface CategoryTotal {
	category_id: string;
	name: string;
	icon: string | null;
	total: number;
}

export interface CategoryDelta extends CategoryTotal {
	prev: number;
	delta: number;
}

/** Whole-percent change from `prev` to `cur`; null when there's nothing to compare against. */
export function pctChange(cur: number, prev: number): number | null {
	if (!prev) return null;
	return Math.round(((cur - prev) / prev) * 100);
}

/** Straight-line projection of spending to the end of the month. */
export function projectMonthEnd(spent: number, dayOfMonth: number, daysInMonth: number): number {
	if (dayOfMonth <= 0) return spent;
	return Math.round((spent / Math.min(dayOfMonth, daysInMonth)) * daysInMonth);
}

/** Per-category change between two periods, biggest absolute change first. */
export function categoryDeltas(cur: CategoryTotal[], prev: CategoryTotal[]): CategoryDelta[] {
	const out = new Map<string, CategoryDelta>();
	for (const c of cur) out.set(c.category_id, { ...c, prev: 0, delta: c.total });
	for (const p of prev) {
		const c = out.get(p.category_id);
		if (c) Object.assign(c, { prev: p.total, delta: c.total - p.total });
		else out.set(p.category_id, { ...p, total: 0, prev: p.total, delta: -p.total });
	}
	return [...out.values()].filter((d) => d.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Days in [from, to] with no recorded spending. */
export function noSpendDays(daily: { date: string; total: number }[], from: string, to: string): number {
	if (to < from) return 0;
	const spent = new Set(daily.filter((d) => d.total > 0 && d.date >= from && d.date <= to).map((d) => d.date));
	return diffDays(to, from) + 1 - spent.size;
}

/** Share of income kept, in whole percent; null without income. */
export function savingsRate(income: number, expense: number): number | null {
	if (income <= 0) return null;
	return Math.round(((income - expense) / income) * 100);
}

/** The period of equal length immediately before [from, to]. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
	const len = diffDays(to, from) + 1;
	return { from: addDays(from, -len), to: addDays(from, -1) };
}
