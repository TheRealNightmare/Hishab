import type { Account, Category, TxnType } from './types';

/** Reference data shared by every screen; refreshed after any mutation via `changed()`. */
export const refs = $state({
	accounts: [] as Account[],
	categories: [] as Category[],
	loaded: false
});

/** Bumped after any write so pages can re-fetch with `$effect(() => { data.version; load(); })`. */
export const data = $state({ version: 0 });

export async function loadRefs() {
	const { api } = await import('./api');
	const [accounts, categories] = await Promise.all([api.get<Account[]>('accounts'), api.get<Category[]>('categories')]);
	refs.accounts = accounts;
	refs.categories = categories;
	refs.loaded = true;
}

export async function changed() {
	await loadRefs();
	data.version++;
}

export const accountName = (id: string | null | undefined) => refs.accounts.find((a) => a.id === id)?.name ?? '—';
export const category = (id: string | null | undefined) => refs.categories.find((c) => c.id === id);

/* ── Quick add sheet ───────────────────────────────────────────── */
export interface QuickAddPreset {
	id?: string; // editing an existing transaction
	type?: TxnType;
	amount?: number;
	account_id?: string;
	to_account_id?: string;
	category_id?: string;
	date?: string;
	note?: string;
	tags?: string[];
	fee?: number;
	goal_id?: string;
	scheme_id?: string;
	title?: string;
}

export const quickAdd = $state({ open: false, preset: {} as QuickAddPreset });

export function openQuickAdd(preset: QuickAddPreset = {}) {
	quickAdd.preset = preset;
	quickAdd.open = true;
}

/* ── Toasts ────────────────────────────────────────────────────── */
export interface Toast {
	id: number;
	msg: string;
	kind: 'ok' | 'error' | 'info';
}
export const toasts = $state<Toast[]>([]);
let tid = 0;
export function toast(msg: string, kind: Toast['kind'] = 'ok') {
	const id = ++tid;
	toasts.push({ id, msg, kind });
	setTimeout(() => {
		const i = toasts.findIndex((t) => t.id === id);
		if (i >= 0) toasts.splice(i, 1);
	}, 3200);
}

/* ── Confirm dialog ────────────────────────────────────────────── */
export const confirmState = $state({ open: false, title: '', body: '', danger: false, resolve: (_: boolean) => {} });
export function confirmDialog(title: string, body = '', danger = true): Promise<boolean> {
	return new Promise((resolve) => {
		Object.assign(confirmState, { open: true, title, body, danger, resolve });
	});
}

/* ── Last-used account (per device convenience) ────────────────── */
export function lastAccount(): string | null {
	try {
		return localStorage.getItem('hishab:last-account');
	} catch {
		return null;
	}
}
export function rememberAccount(id: string) {
	try {
		localStorage.setItem('hishab:last-account', id);
	} catch {
		/* storage unavailable */
	}
}
