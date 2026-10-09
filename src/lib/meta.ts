import type { AccountType, CalendarEvent, Category } from './types';

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string; color: string }[] = [
	{ value: 'cash', label: 'Cash', icon: '💵', color: '#98971a' },
	{ value: 'bank', label: 'Bank', icon: '🏦', color: '#458588' },
	{ value: 'wallet', label: 'Mobile wallet', icon: '📲', color: '#b16286' },
	{ value: 'card', label: 'Credit card', icon: '💳', color: '#d65d0e' },
	{ value: 'savings', label: 'Savings', icon: '🐖', color: '#689d6a' }
];

export const WALLET_PROVIDERS = [
	{ name: 'bKash', color: '#e2136e' },
	{ name: 'Nagad', color: '#f6921e' },
	{ name: 'Rocket', color: '#8c3494' },
	{ name: 'Upay', color: '#0054a6' }
];

export const typeMeta = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t)!;

export const SWATCHES = ['#cc241d', '#d65d0e', '#d79921', '#98971a', '#689d6a', '#458588', '#b16286', '#7c6f64', '#076678', '#8f3f71', '#427b58', '#af3a03'];

/** The bKash × City Bank digital loan preset. Terms change; the form lets you edit them. */
export const BKASH_LOAN_PRESET = {
	name: 'bKash Digital Loan',
	lender: 'City Bank × bKash',
	annual_rate: 9,
	tenure_months: 3,
	method: 'reducing' as const
};

/** Icon, colour and label for each kind of due date (dashboard, calendar). */
export const DUE_META: Record<CalendarEvent['kind'], { icon: string; bg: string; label: string }> = {
	emi: { icon: '🏦', bg: 'var(--color-orange)', label: 'EMI' },
	card: { icon: '💳', bg: 'var(--color-red)', label: 'Card bill' },
	semester: { icon: '🎓', bg: 'var(--color-blue)', label: 'Uni fee' },
	dps: { icon: '🐖', bg: 'var(--color-aqua)', label: 'DPS' },
	recurring: { icon: '🔁', bg: 'var(--color-purple)', label: 'Recurring' }
};

/** Categories the app books by itself (loan principal, lend/borrow), so they're hidden from pickers. */
export const isBookkeeping = (c: Category) => c.system === 'loan' || c.system === 'debt';
