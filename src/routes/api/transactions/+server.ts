import { json } from '@sveltejs/kit';
import { all, body, newId, run } from '#lib/server/db';
import { parseTxn } from '#lib/server/queries';
import { txnSchema } from '#lib/server/schemas';
import { txnStatements } from '#lib/server/txn';
import type { RequestHandler } from './$types';

/**
 * GET /api/transactions?from&to&account&category&type&tag&q&limit&offset
 * Fee/interest child rows are included (they are real money movements) and carry parent_id.
 */
export const GET: RequestHandler = async ({ url }) => {
	const p = url.searchParams;
	const where: string[] = [];
	const args: unknown[] = [];
	const add = (sql: string, ...v: unknown[]) => {
		where.push(sql);
		args.push(...v);
	};
	if (p.get('from')) add('t.date >= ?', p.get('from'));
	if (p.get('to')) add('t.date <= ?', p.get('to'));
	if (p.get('account')) add('(t.account_id = ? OR t.to_account_id = ?)', p.get('account'), p.get('account'));
	if (p.get('category')) add('(t.category_id = ? OR c.parent_id = ?)', p.get('category'), p.get('category'));
	if (p.get('type')) add('t.type = ?', p.get('type'));
	if (p.get('goal')) add('t.goal_id = ?', p.get('goal'));
	if (p.get('scheme')) add('t.scheme_id = ?', p.get('scheme'));
	if (p.get('tag')) add('EXISTS (SELECT 1 FROM json_each(t.tags) WHERE value = ?)', p.get('tag'));
	if (p.get('q')) {
		const q = `%${p.get('q')!.replace(/[%_]/g, '')}%`;
		add('(t.note LIKE ? OR t.tags LIKE ? OR c.name LIKE ?)', q, q, q);
	}
	const limit = Math.min(Number(p.get('limit') ?? 100), 500);
	const offset = Number(p.get('offset') ?? 0);

	const rows = await all<Record<string, unknown>>(
		`SELECT t.* FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
		 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?`,
		...args,
		limit,
		offset
	);
	return json(rows.map(parseTxn));
};

export const POST: RequestHandler = async ({ request }) => {
	const t = await body(request, txnSchema);
	const id = newId('txn');
	await run(await txnStatements(id, t));
	return json({ id }, { status: 201 });
};
