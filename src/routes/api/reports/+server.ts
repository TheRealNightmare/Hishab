import { error, json } from '@sveltejs/kit';
import { report } from '#lib/server/queries';
import type { RequestHandler } from './$types';

const iso = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = async ({ url }) => {
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	if (!iso.test(from) || !iso.test(to)) error(400, 'from and to must be YYYY-MM-DD');
	return json(await report(from, to));
};
