import { error, json } from '@sveltejs/kit';
import { body, db, first, run } from '#lib/server/db';
import { parseTxn } from '#lib/server/queries';
import { txnSchema } from '#lib/server/schemas';
import { deleteTxnStatements, txnStatements } from '#lib/server/txn';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const row = await first<Record<string, unknown>>('SELECT * FROM transactions WHERE id = ?', params.id);
	if (!row) error(404, 'Not found');
	return json(parseTxn(row));
};

/** Replace a transaction: rewrite the row and regenerate its fee child, keeping links (loan, fee, recurring). */
export const PUT: RequestHandler = async ({ params, request }) => {
	const existing = await first<Record<string, unknown>>('SELECT * FROM transactions WHERE id = ?', params.id);
	if (!existing) error(404, 'Not found');
	if (existing.parent_id) error(400, 'Edit the parent transaction instead');
	if (existing.loan_installment_id) error(400, 'Loan payments can only be deleted and re-paid');
	const t = await body(request, txnSchema);
	const keep = {
		semester_fee_id: existing.semester_fee_id,
		recurring_id: existing.recurring_id,
		created_at: existing.created_at
	};
	await run([
		db().prepare('DELETE FROM transactions WHERE parent_id = ?').bind(params.id),
		db().prepare('DELETE FROM transactions WHERE id = ?').bind(params.id),
		...(await txnStatements(params.id, t, keep))
	]);
	return json({ id: params.id });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = await first<{ parent_id: string | null }>('SELECT parent_id FROM transactions WHERE id = ?', params.id);
	if (!existing) error(404, 'Not found');
	await run(deleteTxnStatements(existing.parent_id ?? params.id));
	return json({ ok: true });
};
