-- Lend/borrow with people. Cash really moves, but 'debt' categories are left out of income/expense
-- reports (like 'loan'). A person's balance = debt expenses − debt incomes: positive means they owe you.

CREATE TABLE people (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	phone TEXT,
	note TEXT,
	archived INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE transactions ADD COLUMN person_id TEXT REFERENCES people(id) ON DELETE SET NULL;
CREATE INDEX idx_txn_person ON transactions(person_id, date);

INSERT OR IGNORE INTO categories (id, name, kind, icon, color, system, sort) VALUES
	('cat_debt_out', 'Lent / Paid back', 'expense', '🤝', '#7c6f64', 'debt', 98),
	('cat_debt_in', 'Borrowed / Got back', 'income', '🤝', '#7c6f64', 'debt', 98);
