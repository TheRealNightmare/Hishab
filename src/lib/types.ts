export type AccountType = 'cash' | 'bank' | 'wallet' | 'card' | 'savings';
export type TxnType = 'income' | 'expense' | 'transfer';

export interface Account {
	id: string;
	name: string;
	type: AccountType;
	provider: string | null;
	opening_balance: number;
	credit_limit: number | null;
	statement_day: number | null;
	due_day: number | null;
	min_due_pct: number | null;
	color: string | null;
	archived: number;
	sort: number;
	balance?: number;
}

export interface Category {
	id: string;
	name: string;
	kind: 'income' | 'expense';
	icon: string | null;
	color: string | null;
	parent_id: string | null;
	system: string | null;
	archived: number;
	sort: number;
}

export interface Txn {
	id: string;
	date: string;
	type: TxnType;
	amount: number;
	account_id: string;
	to_account_id: string | null;
	category_id: string | null;
	fee: number;
	parent_id: string | null;
	note: string | null;
	tags: string[];
	loan_installment_id: string | null;
	semester_fee_id: string | null;
	goal_id: string | null;
	scheme_id: string | null;
	recurring_id: string | null;
	created_at: string;
}

export interface Loan {
	id: string;
	name: string;
	lender: string | null;
	principal: number;
	annual_rate: number;
	tenure_months: number;
	method: 'reducing' | 'flat';
	processing_fee: number;
	start_date: string;
	disburse_account_id: string | null;
	status: 'active' | 'closed';
	note: string | null;
	paid_principal?: number;
	paid_count?: number;
	next_due?: string | null;
	next_amount?: number | null;
}

export interface Installment {
	id: string;
	loan_id: string;
	seq: number;
	due_date: string;
	principal: number;
	interest: number;
	amount: number;
	paid_txn_id: string | null;
	paid_date: string | null;
}

export interface Semester {
	id: string;
	name: string;
	start_date: string;
	end_date: string;
	fees?: SemesterFee[];
	fees_total?: number;
	fees_paid?: number;
	spent?: number;
}

export interface SemesterFee {
	id: string;
	semester_id: string;
	label: string;
	amount: number;
	due_date: string | null;
	paid_txn_id: string | null;
}

export interface Goal {
	id: string;
	name: string;
	target: number;
	deadline: string | null;
	account_id: string | null;
	color: string | null;
	archived: number;
	saved?: number;
}

export interface Scheme {
	id: string;
	type: 'dps' | 'fdr';
	name: string;
	bank: string | null;
	account_id: string | null;
	monthly_amount: number | null;
	principal: number | null;
	annual_rate: number | null;
	start_date: string;
	maturity_date: string;
	expected_maturity: number | null;
	installment_day: number | null;
	status: 'active' | 'matured' | 'closed';
	deposited?: number;
	paid_this_month?: number;
}

export interface Budget {
	id: string;
	category_id: string;
	amount: number;
	month: string | null;
}

export interface Recurring {
	id: string;
	name: string;
	template: RecurringTemplate;
	freq: 'monthly' | 'weekly';
	day: number | null;
	next_date: string;
	active: number;
}

export interface RecurringTemplate {
	type: TxnType;
	amount: number;
	account_id: string;
	to_account_id?: string | null;
	category_id?: string | null;
	note?: string | null;
	tags?: string[];
}

export interface Due {
	kind: 'emi' | 'card' | 'semester' | 'dps';
	ref_id: string;
	title: string;
	subtitle: string;
	date: string;
	amount: number;
	href: string;
	overdue: boolean;
}

export interface CardSummary {
	account_id: string;
	period_start: string;
	period_end: string;
	due_date: string;
	next_close: string;
	statement_amount: number;
	paid_since: number;
	remaining: number;
	min_due: number;
	outstanding: number;
}

export interface Dashboard {
	month: string;
	net_worth: number;
	assets: number;
	liabilities: number;
	loan_outstanding: number;
	accounts: Account[];
	income: number;
	expense: number;
	by_category: { category_id: string; name: string; icon: string | null; color: string | null; total: number }[];
	daily: { date: string; total: number }[];
	budgets: { category_id: string; name: string; icon: string | null; color: string | null; limit: number; spent: number }[];
	goals: Goal[];
	dues: Due[];
	cards: CardSummary[];
	recent: Txn[];
	onboarded: boolean;
}
