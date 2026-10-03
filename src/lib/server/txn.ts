import { error } from '@sveltejs/kit';
import type { z } from 'zod';
import { categoryIdBySystem, db, first, insert, newId } from './db';
import type { txnSchema } from './schemas';

export type TxnInput = z.infer<typeof txnSchema>;

/** Statements to write a transaction plus its fee row (a linked expense on the source account). */
export async function txnStatements(id: string, t: TxnInput, extra: Record<string, unknown> = {}) {
	await assertAccounts(t.account_id, t.to_account_id);
	const isTransfer = t.type === 'transfer';
	const row = {
		id,
		date: t.date,
		type: t.type,
		amount: t.amount,
		account_id: t.account_id,
		to_account_id: isTransfer ? t.to_account_id : null,
		category_id: isTransfer ? null : (t.category_id ?? null),
		fee: t.fee,
		note: t.note ?? null,
		tags: t.tags,
		goal_id: t.goal_id ?? null,
		scheme_id: t.scheme_id ?? null,
		...extra
	};
	const stmts = [insert('transactions', row)];
	if (t.fee > 0) {
		stmts.push(
			insert('transactions', {
				id: newId('txn'),
				date: t.date,
				type: 'expense',
				amount: t.fee,
				account_id: t.account_id,
				category_id: await categoryIdBySystem('fees'),
				parent_id: id,
				note: `Fee: ${t.note || (isTransfer ? 'transfer' : t.type)}`,
				tags: '[]'
			})
		);
	}
	return stmts;
}

async function assertAccounts(...ids: (string | null | undefined)[]) {
	for (const id of ids) {
		if (!id) continue;
		const ok = await first('SELECT 1 FROM accounts WHERE id = ?', id);
		if (!ok) error(400, `Unknown account ${id}`);
	}
}

/** Unlink a transaction from installments/fees it paid, then delete it (fee/interest children cascade). */
export function deleteTxnStatements(id: string) {
	const d = db();
	return [
		d.prepare('UPDATE loan_installments SET paid_txn_id = NULL, paid_date = NULL WHERE paid_txn_id = ?').bind(id),
		d.prepare(`UPDATE loans SET status = 'active' WHERE id IN (SELECT loan_id FROM loan_installments WHERE id IN (SELECT loan_installment_id FROM transactions WHERE id = ?))`).bind(id),
		d.prepare('UPDATE semester_fees SET paid_txn_id = NULL WHERE paid_txn_id = ?').bind(id),
		d.prepare('DELETE FROM transactions WHERE parent_id = ?').bind(id),
		d.prepare('DELETE FROM transactions WHERE id = ?').bind(id)
	];
}
