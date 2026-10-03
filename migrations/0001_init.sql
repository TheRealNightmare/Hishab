-- Hishab schema. All money columns are INTEGER paisa (1 ৳ = 100). Dates are ISO 'YYYY-MM-DD'.

CREATE TABLE accounts (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'wallet', 'card', 'savings')),
	provider TEXT,
	opening_balance INTEGER NOT NULL DEFAULT 0, -- for cards: amount owed, stored negative
	credit_limit INTEGER,
	statement_day INTEGER,
	due_day INTEGER,
	min_due_pct REAL,
	color TEXT,
	archived INTEGER NOT NULL DEFAULT 0,
	sort INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
	icon TEXT,
	color TEXT,
	parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
	system TEXT, -- 'fees' | 'interest' | 'uni' | 'loan' marks categories the app relies on; 'loan' is excluded from income/expense reports
	archived INTEGER NOT NULL DEFAULT 0,
	sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE semesters (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	start_date TEXT NOT NULL,
	end_date TEXT NOT NULL
);

CREATE TABLE semester_fees (
	id TEXT PRIMARY KEY,
	semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
	label TEXT NOT NULL,
	amount INTEGER NOT NULL,
	due_date TEXT,
	paid_txn_id TEXT
);

CREATE TABLE loans (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	lender TEXT,
	principal INTEGER NOT NULL,
	annual_rate REAL NOT NULL DEFAULT 0,
	tenure_months INTEGER NOT NULL,
	method TEXT NOT NULL DEFAULT 'reducing' CHECK (method IN ('reducing', 'flat')),
	processing_fee INTEGER NOT NULL DEFAULT 0,
	start_date TEXT NOT NULL, -- first installment due date
	disburse_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
	note TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE loan_installments (
	id TEXT PRIMARY KEY,
	loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
	seq INTEGER NOT NULL,
	due_date TEXT NOT NULL,
	principal INTEGER NOT NULL,
	interest INTEGER NOT NULL,
	amount INTEGER NOT NULL,
	paid_txn_id TEXT,
	paid_date TEXT
);

CREATE TABLE goals (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	target INTEGER NOT NULL,
	deadline TEXT,
	account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
	color TEXT,
	archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE schemes (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL CHECK (type IN ('dps', 'fdr')),
	name TEXT NOT NULL,
	bank TEXT,
	account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
	monthly_amount INTEGER, -- DPS
	principal INTEGER, -- FDR
	annual_rate REAL,
	start_date TEXT NOT NULL,
	maturity_date TEXT NOT NULL,
	expected_maturity INTEGER,
	installment_day INTEGER,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'matured', 'closed'))
);

CREATE TABLE recurring (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	template TEXT NOT NULL, -- JSON: { type, amount, account_id, to_account_id, category_id, note, tags }
	freq TEXT NOT NULL CHECK (freq IN ('monthly', 'weekly')),
	day INTEGER, -- monthly anchor day so 31st doesn't drift to 28th
	next_date TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transactions (
	id TEXT PRIMARY KEY,
	date TEXT NOT NULL,
	type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
	amount INTEGER NOT NULL CHECK (amount > 0),
	account_id TEXT NOT NULL REFERENCES accounts(id),
	to_account_id TEXT REFERENCES accounts(id),
	category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
	fee INTEGER NOT NULL DEFAULT 0,
	parent_id TEXT REFERENCES transactions(id) ON DELETE CASCADE, -- fee rows point at their transfer
	note TEXT,
	tags TEXT NOT NULL DEFAULT '[]',
	loan_installment_id TEXT REFERENCES loan_installments(id) ON DELETE SET NULL,
	semester_fee_id TEXT REFERENCES semester_fees(id) ON DELETE SET NULL,
	goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
	scheme_id TEXT REFERENCES schemes(id) ON DELETE SET NULL,
	recurring_id TEXT REFERENCES recurring(id) ON DELETE SET NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_txn_date ON transactions(date);
CREATE INDEX idx_txn_account ON transactions(account_id, date);
CREATE INDEX idx_txn_to_account ON transactions(to_account_id, date);
CREATE INDEX idx_txn_category ON transactions(category_id, date);
CREATE INDEX idx_txn_parent ON transactions(parent_id);
CREATE INDEX idx_inst_loan ON loan_installments(loan_id, seq);
CREATE INDEX idx_fee_sem ON semester_fees(semester_id);

CREATE TABLE budgets (
	id TEXT PRIMARY KEY,
	category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	amount INTEGER NOT NULL,
	month TEXT -- NULL = default for every month, or 'YYYY-MM' override
);
CREATE UNIQUE INDEX idx_budget_cat_month ON budgets(category_id, IFNULL(month, ''));

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

-- Seed categories
INSERT INTO categories (id, name, kind, icon, color, system, sort) VALUES
	('cat_food', 'Food', 'expense', '🍛', '#d65d0e', NULL, 1),
	('cat_transport', 'Transport', 'expense', '🛺', '#458588', NULL, 2),
	('cat_recharge', 'Mobile Recharge', 'expense', '📱', '#b16286', NULL, 3),
	('cat_internet', 'Internet', 'expense', '🌐', '#689d6a', NULL, 4),
	('cat_uni', 'University', 'expense', '🎓', '#076678', 'uni', 5),
	('cat_rent', 'Rent', 'expense', '🏠', '#af3a03', NULL, 6),
	('cat_family', 'Family', 'expense', '👪', '#8f3f71', NULL, 7),
	('cat_health', 'Health', 'expense', '💊', '#cc241d', NULL, 8),
	('cat_shopping', 'Shopping', 'expense', '🛍️', '#d79921', NULL, 9),
	('cat_fun', 'Entertainment', 'expense', '🎮', '#98971a', NULL, 10),
	('cat_subs', 'Subscriptions', 'expense', '🔁', '#427b58', NULL, 11),
	('cat_fees', 'Charges & Fees', 'expense', '🧾', '#7c6f64', 'fees', 12),
	('cat_interest', 'Loan Interest', 'expense', '📉', '#9d0006', 'interest', 13),
	('cat_other_exp', 'Other', 'expense', '📦', '#928374', NULL, 14),
	('cat_loan_repay', 'Loan Repayment', 'expense', '🏦', '#504945', 'loan', 99),
	('cat_salary', 'Salary', 'income', '💼', '#79740e', NULL, 1),
	('cat_tuition', 'Tuition', 'income', '📚', '#427b58', NULL, 2),
	('cat_allowance', 'Family Allowance', 'income', '🤲', '#8f3f71', NULL, 3),
	('cat_other_inc', 'Other Income', 'income', '✨', '#b57614', NULL, 4),
	('cat_loan_in', 'Loan Received', 'income', '🏦', '#504945', 'loan', 99);

INSERT INTO settings (key, value) VALUES ('due_window_days', '30'), ('onboarded', '0');
