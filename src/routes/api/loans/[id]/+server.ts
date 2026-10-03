import { error, json } from '@sveltejs/kit';
import { all, body, db, first, run, update } from '#lib/server/db';
import { loanPatchSchema } from '#lib/server/schemas';
import type { Installment, Loan } from '#lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const loan = await first<Loan>('SELECT * FROM loans WHERE id = ?', params.id);
	if (!loan) error(404, 'Not found');
	const installments = await all<Installment>('SELECT * FROM loan_installments WHERE loan_id = ? ORDER BY seq', params.id);
	return json({ loan, installments });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const data = await body(request, loanPatchSchema);
	const stmt = update('loans', params.id, data);
	if (stmt) await run([stmt]);
	return json({ id: params.id });
};

/** Deletes the loan and schedule. Payment transactions stay in history (their link is cleared). */
export const DELETE: RequestHandler = async ({ params }) => {
	await run([db().prepare('DELETE FROM loans WHERE id = ?').bind(params.id)]);
	return json({ ok: true });
};
