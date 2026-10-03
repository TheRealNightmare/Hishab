import { error, json } from '@sveltejs/kit';
import { body, categoryIdBySystem, db, first, insert, newId, run } from '#lib/server/db';
import { payInstallmentSchema } from '#lib/server/schemas';
import type { Installment, Loan } from '#lib/types';
import type { RequestHandler } from './$types';

/**
 * Pay one installment: principal is booked as "Loan Repayment" (excluded from expense reports,
 * since it reduces the loan rather than being spending) and interest as "Loan Interest".
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const p = await body(request, payInstallmentSchema);
	const loan = await first<Loan>('SELECT * FROM loans WHERE id = ?', params.id);
	if (!loan) error(404, 'Loan not found');
	const inst = await first<Installment>('SELECT * FROM loan_installments WHERE id = ? AND loan_id = ?', p.installment_id, params.id);
	if (!inst) error(404, 'Installment not found');
	if (inst.paid_date) error(409, 'Already paid');
	if (!(await first('SELECT 1 FROM accounts WHERE id = ?', p.account_id))) error(400, 'Unknown account');

	const txnId = newId('txn');
	const label = `${loan.name} EMI ${inst.seq}/${loan.tenure_months}`;
	const stmts: D1PreparedStatement[] = [
		insert('transactions', {
			id: txnId,
			date: p.date,
			type: 'expense',
			amount: inst.principal,
			account_id: p.account_id,
			category_id: await categoryIdBySystem('loan'),
			loan_installment_id: inst.id,
			note: label,
			tags: '["loan"]'
		})
	];
	if (inst.interest > 0) {
		stmts.push(
			insert('transactions', {
				id: newId('txn'),
				date: p.date,
				type: 'expense',
				amount: inst.interest,
				account_id: p.account_id,
				category_id: await categoryIdBySystem('interest'),
				parent_id: txnId,
				note: `${label} interest`,
				tags: '["loan"]'
			})
		);
	}
	stmts.push(
		db().prepare('UPDATE loan_installments SET paid_txn_id = ?, paid_date = ? WHERE id = ?').bind(txnId, p.date, inst.id),
		db()
			.prepare(
				`UPDATE loans SET status = 'closed' WHERE id = ?1
				 AND NOT EXISTS (SELECT 1 FROM loan_installments WHERE loan_id = ?1 AND paid_date IS NULL)`
			)
			.bind(params.id)
	);
	await run(stmts);
	return json({ id: txnId }, { status: 201 });
};
