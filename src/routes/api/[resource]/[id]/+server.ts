import { error, json } from '@sveltejs/kit';
import { body, db, first, run, update } from '#lib/server/db';
import { resources } from '#lib/server/resources';
import type { RequestHandler } from './$types';

function resource(name: string) {
	const r = resources[name];
	if (!r) error(404, 'Not found');
	return r;
}

export const PUT: RequestHandler = async ({ params, request }) => {
	const r = resource(params.resource);
	const data = await body(request, r.schema.partial());
	if (r.table === 'categories' && 'kind' in data) {
		const used = await first('SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1', params.id);
		if (used) delete (data as Record<string, unknown>).kind;
	}
	const stmt = update(r.table, params.id, data);
	if (stmt) {
		const [res] = await run([stmt]);
		if (!res.meta.changes) error(404, 'Not found');
	}
	return json({ id: params.id });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const r = resource(params.resource);
	if (r.table === 'categories') {
		const sys = await first<{ system: string | null }>('SELECT system FROM categories WHERE id = ?', params.id);
		if (sys?.system) error(409, 'This category is used by the app. Archive or rename it instead.');
	}
	// Transactions keep their history: category/goal/scheme links are ON DELETE SET NULL.
	await run([db().prepare(`DELETE FROM ${r.table} WHERE id = ?`).bind(params.id)]);
	return json({ ok: true });
};
