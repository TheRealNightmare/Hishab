import { error, json } from '@sveltejs/kit';
import { body, insert, newId, run } from '#lib/server/db';
import { resources } from '#lib/server/resources';
import type { RequestHandler } from './$types';

function resource(name: string) {
	const r = resources[name];
	if (!r) error(404, 'Not found');
	return r;
}

export const GET: RequestHandler = async ({ params }) => {
	return json(await resource(params.resource).list());
};

export const POST: RequestHandler = async ({ params, request }) => {
	const r = resource(params.resource);
	const data = await body(request, r.schema);
	const id = newId(r.prefix);
	await run([insert(r.table, { id, ...data })]);
	return json({ id }, { status: 201 });
};
