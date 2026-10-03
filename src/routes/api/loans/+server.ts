import { json } from '@sveltejs/kit';
import { body, categoryIdBySystem, insert, newId, run } from '#lib/server/db';
import { loansWithProgress } from '#lib/server/queries';
import { loanSchema } from '#lib/server/schemas';
import { buildSchedule } from '#lib/domain/emi';
import { today } from '#lib/domain/dates';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await loansWithProgress());

/**
 * Create a loan and its installment schedule. If `disburse_account_id` is set, the loan amount
 * lands in that account as "Loan Received" (excluded from income reports) and any processing
 * fee is booked as a Charges & Fees expense. `paid_installments` marks the first N as already
 * paid, for loans taken before starting Hishab.
 */
export const POST: RequestHandler = async ({ request }) => {
	const l = await body(request, loanSchema);
	const id = newId('loan');
	const rows = buildSchedule(l);
	const paidN = Math.min(l.paid_installments, rows.length);

	const stmts: D1PreparedStatement[] = [
		insert('loans', {
			id,
			name: l.name,
			lender: l.lender ?? null,
			principal: l.principal,
			annual_rate: l.annual_rate,
			tenure_months: l.tenure_months,
			method: l.method,
			processing_fee: l.processing_fee,
			start_date: l.start_date,
			disburse_account_id: l.disburse_account_id ?? null,
			status: paidN === rows.length ? 'closed' : 'active',
			note: l.note ?? null
		}),
		...rows.map((r, k) =>
			insert('loan_installments', {
				id: newId('inst'),
				loan_id: id,
				...r,
				paid_date: k < paidN ? r.due_date : null,
				paid_txn_id: k < paidN ? 'opening' : null
			})
		)
	];

	if (l.disburse_account_id) {
		const date = l.disbursed_on ?? today();
		const inId = newId('txn');
		stmts.push(
			insert('transactions', {
				id: inId,
				date,
				type: 'income',
				amount: l.principal,
				account_id: l.disburse_account_id,
				category_id: await categoryIdBySystem('loan', 'income'),
				note: `${l.name} disbursed`,
				tags: '["loan"]'
			})
		);
		if (l.processing_fee > 0) {
			stmts.push(
				insert('transactions', {
					id: newId('txn'),
					date,
					type: 'expense',
					amount: l.processing_fee,
					account_id: l.disburse_account_id,
					category_id: await categoryIdBySystem('fees'),
					parent_id: inId,
					note: `${l.name} processing fee`,
					tags: '["loan"]'
				})
			);
		}
	}

	await run(stmts);
	return json({ id }, { status: 201 });
};
