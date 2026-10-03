import { json } from '@sveltejs/kit';
import { runRecurring } from '#lib/server/recurring';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => json({ created: await runRecurring() });
