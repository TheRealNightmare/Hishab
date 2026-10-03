import { all, db, insert, newId, run } from './db';
import { dueOccurrences, type Freq } from '#lib/domain/recurring';
import { today } from '#lib/domain/dates';
import type { RecurringTemplate } from '#lib/types';

/**
 * Create transactions for every active rule whose next_date has arrived. Each rule's rows and
 * its next_date bump go in one batch, and the UPDATE is guarded on the old next_date, so two
 * concurrent dashboard loads cannot double-post.
 */
export async function runRecurring(on = today()): Promise<number> {
	const rules = await all<{ id: string; name: string; template: string; freq: Freq; day: number | null; next_date: string }>(
		'SELECT * FROM recurring WHERE active = 1 AND next_date <= ?',
		on
	);
	let created = 0;
	for (const r of rules) {
		const t = JSON.parse(r.template) as RecurringTemplate;
		const { dates, next } = dueOccurrences(r.next_date, r.freq, on, r.day);
		if (dates.length === 0) continue;

		const claim = await db()
			.prepare('UPDATE recurring SET next_date = ? WHERE id = ? AND next_date = ?')
			.bind(next, r.id, r.next_date)
			.run();
		if (!claim.meta.changes) continue; // another request got it first

		await run(
			dates.map((date) =>
				insert('transactions', {
					id: newId('txn'),
					date,
					type: t.type,
					amount: t.amount,
					account_id: t.account_id,
					to_account_id: t.type === 'transfer' ? (t.to_account_id ?? null) : null,
					category_id: t.type === 'transfer' ? null : (t.category_id ?? null),
					note: t.note || r.name,
					tags: t.tags ?? [],
					recurring_id: r.id
				})
			)
		);
		created += dates.length;
	}
	return created;
}
