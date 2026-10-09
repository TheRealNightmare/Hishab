import { json } from '@sveltejs/kit';
import { all } from '#lib/server/db';
import { addDays, today } from '#lib/domain/dates';
import type { RequestHandler } from './$types';

/**
 * GET /api/transactions/favourites → entries you keep repeating (same type, category, account,
 * amount and note at least twice in the last 90 days), most used first. Rows booked by loan,
 * fee, goal, DPS, recurring or lend/borrow flows are left out because they have their own buttons.
 */
export const GET: RequestHandler = async () => {
	const rows = await all(
		`SELECT t.type, t.category_id, t.account_id, t.amount, t.note, COUNT(*) AS uses, MAX(t.date) AS last_date
		 FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
		 WHERE t.parent_id IS NULL AND t.type IN ('expense', 'income') AND t.date >= ?1
		   AND t.loan_installment_id IS NULL AND t.semester_fee_id IS NULL AND t.goal_id IS NULL
		   AND t.scheme_id IS NULL AND t.recurring_id IS NULL AND t.person_id IS NULL
		   AND (c.system IS NULL OR c.system NOT IN ('loan', 'debt', 'interest'))
		 GROUP BY t.type, t.category_id, t.account_id, t.amount, COALESCE(t.note, '')
		 HAVING uses >= 2
		 ORDER BY uses DESC, last_date DESC
		 LIMIT 8`,
		addDays(today(), -90)
	);
	return json(rows);
};
