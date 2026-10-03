import { error, json } from '@sveltejs/kit';
import { first } from '#lib/server/db';
import { accountBalance, cardSummary } from '#lib/server/queries';
import type { Account } from '#lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const acc = await first<Account>('SELECT * FROM accounts WHERE id = ?', params.id);
	if (!acc || acc.type !== 'card') error(404, 'Card not found');
	acc.balance = await accountBalance(acc.id, '9999-12-31');
	return json(await cardSummary(acc));
};
