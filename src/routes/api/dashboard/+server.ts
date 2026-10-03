import { json } from '@sveltejs/kit';
import { dashboard } from '#lib/server/queries';
import { runRecurring } from '#lib/server/recurring';
import { monthKey, today } from '#lib/domain/dates';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	// Pages has no cron, so recurring entries are materialised whenever the dashboard loads.
	await runRecurring();
	const month = url.searchParams.get('month') ?? monthKey(today());
	return json(await dashboard(/^\d{4}-\d{2}$/.test(month) ? month : monthKey(today())));
};
