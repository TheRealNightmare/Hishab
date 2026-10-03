import { error, json } from '@sveltejs/kit';
import { body, categoryIdBySystem, db, first, insert, newId, run } from '#lib/server/db';
import { payFeeSchema } from '#lib/server/schemas';
import type { SemesterFee } from '#lib/types';
import type { RequestHandler } from './$types';

/** Pay a semester fee installment from an account; booked under the University category. */
export const POST: RequestHandler = async ({ params, request }) => {
	const p = await body(request, payFeeSchema);
	const fee = await first<SemesterFee & { semester: string }>(
		'SELECT f.*, s.name AS semester FROM semester_fees f JOIN semesters s ON s.id = f.semester_id WHERE f.id = ?',
		params.id
	);
	if (!fee) error(404, 'Fee not found');
	if (fee.paid_txn_id) error(409, 'Already paid');
	if (!(await first('SELECT 1 FROM accounts WHERE id = ?', p.account_id))) error(400, 'Unknown account');

	const txnId = newId('txn');
	await run([
		insert('transactions', {
			id: txnId,
			date: p.date,
			type: 'expense',
			amount: fee.amount,
			account_id: p.account_id,
			category_id: await categoryIdBySystem('uni'),
			semester_fee_id: fee.id,
			note: `${fee.semester}: ${fee.label}`,
			tags: '["uni"]'
		}),
		db().prepare('UPDATE semester_fees SET paid_txn_id = ? WHERE id = ?').bind(txnId, fee.id)
	]);
	return json({ id: txnId }, { status: 201 });
};
