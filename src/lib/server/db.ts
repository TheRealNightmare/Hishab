import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { customAlphabet } from 'nanoid';
import type { z } from 'zod';

export function db(): D1Database {
	return env.DB;
}

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 14);
export const newId = (prefix: string) => `${prefix}_${nano()}`;

export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		error(400, `${issue.path.join('.') || 'body'}: ${issue.message}`);
	}
	return parsed.data;
}

/** Build an INSERT from a plain object (keys must already be validated column names). */
export function insert(table: string, row: Record<string, unknown>): D1PreparedStatement {
	const keys = Object.keys(row).filter((k) => row[k] !== undefined);
	const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
	return db()
		.prepare(sql)
		.bind(...keys.map((k) => normalize(row[k])));
}

export function update(table: string, id: string, row: Record<string, unknown>): D1PreparedStatement | null {
	const keys = Object.keys(row).filter((k) => row[k] !== undefined && k !== 'id');
	if (keys.length === 0) return null;
	const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
	return db()
		.prepare(sql)
		.bind(...keys.map((k) => normalize(row[k])), id);
}

function normalize(v: unknown) {
	if (typeof v === 'boolean') return v ? 1 : 0;
	if (Array.isArray(v) || (v !== null && typeof v === 'object')) return JSON.stringify(v);
	return v ?? null;
}

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
	const r = await db()
		.prepare(sql)
		.bind(...params)
		.all<T>();
	return r.results;
}

export async function first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
	return db()
		.prepare(sql)
		.bind(...params)
		.first<T>();
}

export async function categoryIdBySystem(system: string, kind: 'income' | 'expense' = 'expense'): Promise<string | null> {
	const row = await first<{ id: string }>('SELECT id FROM categories WHERE system = ? AND kind = ? ORDER BY archived, sort LIMIT 1', system, kind);
	return row?.id ?? null;
}

/** Map a D1 FK constraint failure to a friendly 409. */
export async function run(stmts: D1PreparedStatement[]) {
	try {
		return await db().batch(stmts);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('FOREIGN KEY')) error(409, 'This item is still used elsewhere. Archive it instead.');
		if (msg.includes('UNIQUE')) error(409, 'That already exists.');
		throw e;
	}
}
