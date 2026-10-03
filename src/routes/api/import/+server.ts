import { error, json } from '@sveltejs/kit';
import { all, db } from '#lib/server/db';
import { EXPORT_TABLES } from '#lib/server/backup';
import type { RequestHandler } from './$types';

/**
 * Restore a JSON backup, replacing ALL current data. Columns are whitelisted against the live
 * schema so a tampered file can't inject SQL identifiers. Runs as one D1 batch (atomic).
 */
export const POST: RequestHandler = async ({ request }) => {
	let payload: { app?: string; data?: Record<string, Record<string, unknown>[]> };
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}
	if (payload.app !== 'hishab' || !payload.data) error(400, 'Not a Hishab backup file');

	const d = db();
	const stmts: D1PreparedStatement[] = [];
	// Delete children first.
	for (const t of [...EXPORT_TABLES].reverse()) stmts.push(d.prepare(`DELETE FROM ${t}`));
	// Transactions reference each other via parent_id, so insert parents first.
	const txns = payload.data.transactions ?? [];
	payload.data.transactions = [...txns.filter((t) => !t.parent_id), ...txns.filter((t) => t.parent_id)];

	let count = 0;
	for (const t of EXPORT_TABLES) {
		const rows = payload.data[t] ?? [];
		if (!rows.length) continue;
		const cols = new Set((await all<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, t)).map((c) => c.name));
		for (const row of rows) {
			const keys = Object.keys(row).filter((k) => cols.has(k));
			if (!keys.length) continue;
			stmts.push(
				d.prepare(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map((k) => row[k] ?? null))
			);
			count++;
		}
	}
	try {
		await d.batch(stmts);
	} catch (e) {
		error(400, `Import failed, nothing was changed: ${e instanceof Error ? e.message : e}`);
	}
	return json({ imported: count });
};
