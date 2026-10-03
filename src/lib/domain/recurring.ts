import { addDays, addMonths } from './dates';

export type Freq = 'monthly' | 'weekly';

export function advance(date: string, freq: Freq, anchorDay?: number | null): string {
	return freq === 'weekly' ? addDays(date, 7) : addMonths(date, 1, anchorDay ?? undefined);
}

/**
 * All occurrence dates from `next` up to and including `until`, plus the new next date.
 * Capped so a long-forgotten rule can't explode into thousands of rows.
 */
export function dueOccurrences(next: string, freq: Freq, until: string, anchorDay?: number | null, cap = 60) {
	const dates: string[] = [];
	let d = next;
	while (d <= until && dates.length < cap) {
		dates.push(d);
		d = advance(d, freq, anchorDay);
	}
	return { dates, next: d };
}
