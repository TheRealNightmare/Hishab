import { json } from '@sveltejs/kit';
import { calendarEvents } from '#lib/server/queries';
import { monthKey, today } from '#lib/domain/dates';
import type { RequestHandler } from './$types';

/** GET /api/calendar?month=YYYY-MM → dues, projected recurring entries and daily spend for the month. */
export const GET: RequestHandler = async ({ url }) => {
	const month = url.searchParams.get('month') ?? '';
	return json(await calendarEvents(/^\d{4}-\d{2}$/.test(month) ? month : monthKey(today())));
};
