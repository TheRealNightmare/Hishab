import { all } from '#lib/server/db';
import { EXPORT_TABLES } from '#lib/server/backup';
import { today } from '#lib/domain/dates';
import type { RequestHandler } from './$types';

/** GET /api/export → full JSON backup; ?format=csv → transactions as CSV. */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('format') === 'csv') {
		const rows = await all<Record<string, unknown>>(`
			SELECT t.date, t.type, printf('%.2f', t.amount / 100.0) AS amount, a.name AS account, ta.name AS to_account,
				c.name AS category, t.note, t.tags, t.id
			FROM transactions t
			JOIN accounts a ON a.id = t.account_id
			LEFT JOIN accounts ta ON ta.id = t.to_account_id
			LEFT JOIN categories c ON c.id = t.category_id
			ORDER BY t.date, t.created_at`);
		const cols = ['date', 'type', 'amount', 'account', 'to_account', 'category', 'note', 'tags', 'id'];
		const esc = (v: unknown) => {
			const s = v == null ? '' : String(v);
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
		return new Response(csv, {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="hishab-transactions-${today()}.csv"`
			}
		});
	}

	const data: Record<string, unknown[]> = {};
	for (const t of EXPORT_TABLES) data[t] = await all(`SELECT * FROM ${t}`);
	return new Response(JSON.stringify({ app: 'hishab', version: 1, exported_at: new Date().toISOString(), data }, null, 1), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="hishab-backup-${today()}.json"`
		}
	});
};
