import { toast } from './stores.svelte';

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

async function request<T>(method: string, path: string, data?: unknown, opts: { quiet?: boolean } = {}): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`/api/${path}`, {
			method,
			headers: data !== undefined ? { 'content-type': 'application/json' } : undefined,
			body: data !== undefined ? JSON.stringify(data) : undefined,
			credentials: 'same-origin',
			redirect: 'manual'
		});
	} catch {
		if (!opts.quiet) toast('Network error. Are you offline?', 'error');
		throw new ApiError(0, 'Network error');
	}
	// Cloudflare Access redirects to its login page when the session expires.
	if (res.type === 'opaqueredirect' || res.status === 401) {
		toast('Session expired. Reloading…', 'error');
		setTimeout(() => location.reload(), 1200);
		throw new ApiError(401, 'Session expired');
	}
	if (!res.ok) {
		let msg = res.statusText;
		try {
			msg = ((await res.json()) as { message?: string }).message ?? msg;
		} catch {
			/* not JSON */
		}
		if (!opts.quiet) toast(msg, 'error');
		throw new ApiError(res.status, msg);
	}
	return res.json() as Promise<T>;
}

export const api = {
	get: <T>(path: string) => request<T>('GET', path),
	post: <T = { id: string }>(path: string, data: unknown) => request<T>('POST', path, data),
	put: <T = { id: string }>(path: string, data: unknown) => request<T>('PUT', path, data),
	del: <T = { ok: true }>(path: string) => request<T>('DELETE', path)
};

export function qs(params: Record<string, string | number | null | undefined>): string {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
	const s = p.toString();
	return s ? `?${s}` : '';
}
