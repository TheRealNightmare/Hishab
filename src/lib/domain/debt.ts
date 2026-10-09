/**
 * Lend/borrow with people. Money you hand over is a 'debt' expense, money you receive is a
 * 'debt' income, so a person's balance = given − received: positive means they owe you.
 */
export function personBalance(rows: { type: 'income' | 'expense'; amount: number }[]): number {
	return rows.reduce((s, r) => s + (r.type === 'expense' ? r.amount : -r.amount), 0);
}

/** Split signed person balances into what others owe you and what you owe them. */
export function debtTotals(balances: number[]): { owed_to_me: number; i_owe: number } {
	let owed_to_me = 0;
	let i_owe = 0;
	for (const b of balances) {
		if (b > 0) owed_to_me += b;
		else i_owe -= b;
	}
	return { owed_to_me, i_owe };
}
