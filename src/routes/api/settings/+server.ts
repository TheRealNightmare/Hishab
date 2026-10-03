import { json } from '@sveltejs/kit';
import { all, body, db, run } from '#lib/server/db';
import { settingsSchema } from '#lib/server/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
	return json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
};

export const PUT: RequestHandler = async ({ request }) => {
	const data = await body(request, settingsSchema);
	const stmts = Object.entries(data).map(([k, v]) =>
		db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v)
	);
	if (stmts.length) await run(stmts);
	return json({ ok: true });
};
