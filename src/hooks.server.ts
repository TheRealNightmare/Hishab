import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// JWKS fetcher caches keys between requests in the same isolate; safe because it holds no per-request state.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeam = '';

/**
 * Cloudflare Access protects the hostname at the edge. The API double-checks the Access JWT
 * so data is not reachable through the *.pages.dev URL or if Access is misconfigured.
 */
async function verifyAccess(request: Request): Promise<string | null> {
	const team = (env.ACCESS_TEAM_DOMAIN as string)?.replace(/^https?:\/\//, '').replace(/\/$/, '');
	const aud = env.ACCESS_AUD as string;
	if (!team || !aud) return 'Access is not configured (ACCESS_TEAM_DOMAIN / ACCESS_AUD)';

	const token = request.headers.get('cf-access-jwt-assertion');
	if (!token) return 'Missing Access token';

	if (!jwks || jwksTeam !== team) {
		jwks = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));
		jwksTeam = team;
	}
	try {
		await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: aud });
		return null;
	} catch {
		return 'Invalid Access token';
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/') && env.DEV_BYPASS !== '1') {
		const problem = await verifyAccess(event.request);
		if (problem) return json({ message: problem }, { status: 401 });
	}
	const response = await resolve(event);
	if (event.url.pathname.startsWith('/api/')) response.headers.set('cache-control', 'no-store');
	return response;
};
