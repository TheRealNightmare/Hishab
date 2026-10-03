import { all, first } from './db';
import { cardCycle, cardStatement } from '#lib/domain/card';
import { addDays, clampDay, monthKey, monthRange, parseISO, today } from '#lib/domain/dates';
import type { Account, CardSummary, Dashboard, Due, Goal, Loan, Scheme, Semester, SemesterFee, Txn } from '#lib/types';

/** Signed flow of a transaction for an account: +in, −out. */
const BALANCE_SQL = `
	a.opening_balance
	+ COALESCE((SELECT SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END)
		FROM transactions t WHERE t.account_id = a.id AND t.date <= ?1), 0)
	+ COALESCE((SELECT SUM(t.amount) FROM transactions t
		WHERE t.type = 'transfer' AND t.to_account_id = a.id AND t.date <= ?1), 0)`;

export async function accountsWithBalances(asOf = '9999-12-31', includeArchived = true): Promise<Account[]> {
	return all<Account>(
		`SELECT a.*, (${BALANCE_SQL}) AS balance FROM accounts a
		 ${includeArchived ? '' : 'WHERE a.archived = 0'}
		 ORDER BY a.archived, a.sort, a.created_at`,
		asOf
	);
}

export async function accountBalance(id: string, asOf: string): Promise<number> {
	const r = await first<{ balance: number }>(`SELECT (${BALANCE_SQL}) AS balance FROM accounts a WHERE a.id = ?2`, asOf, id);
	return r?.balance ?? 0;
}

export function parseTxn(row: Record<string, unknown>): Txn {
	return { ...(row as unknown as Txn), tags: JSON.parse((row.tags as string) || '[]') };
}

export async function cardSummary(acc: Account, on = today()): Promise<CardSummary | null> {
	if (acc.type !== 'card' || !acc.statement_day || !acc.due_day) return null;
	const cycle = cardCycle(acc.statement_day, acc.due_day, on);
	const [atClose, inflow] = await Promise.all([
		accountBalance(acc.id, cycle.period_end),
		first<{ s: number }>(
			`SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
			 WHERE date > ?1 AND date <= ?2
			   AND ((type = 'transfer' AND to_account_id = ?3) OR (type = 'income' AND account_id = ?3))`,
			cycle.period_end,
			on,
			acc.id
		)
	]);
	const current = acc.balance ?? (await accountBalance(acc.id, '9999-12-31'));
	return { account_id: acc.id, ...cardStatement(cycle, atClose, inflow?.s ?? 0, current, acc.min_due_pct ?? 5) };
}

export async function loansWithProgress(): Promise<Loan[]> {
	return all<Loan>(`
		SELECT l.*,
			COALESCE((SELECT SUM(principal) FROM loan_installments i WHERE i.loan_id = l.id AND i.paid_date IS NOT NULL), 0) AS paid_principal,
			(SELECT COUNT(*) FROM loan_installments i WHERE i.loan_id = l.id AND i.paid_date IS NOT NULL) AS paid_count,
			(SELECT MIN(due_date) FROM loan_installments i WHERE i.loan_id = l.id AND i.paid_date IS NULL) AS next_due,
			(SELECT amount FROM loan_installments i WHERE i.loan_id = l.id AND i.paid_date IS NULL ORDER BY seq LIMIT 1) AS next_amount
		FROM loans l ORDER BY l.status, l.created_at DESC`);
}

export async function loanOutstanding(): Promise<number> {
	const r = await first<{ s: number }>(`
		SELECT COALESCE(SUM(i.principal), 0) AS s FROM loan_installments i
		JOIN loans l ON l.id = i.loan_id WHERE l.status = 'active' AND i.paid_date IS NULL`);
	return r?.s ?? 0;
}

export async function goalsWithProgress(): Promise<Goal[]> {
	return all<Goal>(`
		SELECT g.*, COALESCE((SELECT SUM(CASE
				WHEN t.type = 'transfer' AND t.to_account_id = g.account_id THEN t.amount
				WHEN t.type = 'income' AND t.account_id = g.account_id THEN t.amount
				ELSE -t.amount END)
			FROM transactions t WHERE t.goal_id = g.id), 0) AS saved
		FROM goals g ORDER BY g.archived, g.deadline IS NULL, g.deadline`);
}

export async function schemesWithProgress(month = monthKey(today())): Promise<Scheme[]> {
	const { from, to } = monthRange(month);
	return all<Scheme>(
		`SELECT s.*,
			COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.scheme_id = s.id), 0) AS deposited,
			COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.scheme_id = s.id AND t.date BETWEEN ?1 AND ?2), 0) AS paid_this_month
		FROM schemes s ORDER BY s.status, s.maturity_date`,
		from,
		to
	);
}

export async function semestersWithFees(): Promise<Semester[]> {
	const [sems, fees, spent] = await Promise.all([
		all<Semester>('SELECT * FROM semesters ORDER BY start_date DESC'),
		all<SemesterFee>('SELECT * FROM semester_fees ORDER BY due_date IS NULL, due_date'),
		all<{ id: string; spent: number }>(`
			SELECT s.id, COALESCE((SELECT SUM(t.amount) FROM transactions t
				LEFT JOIN categories c ON c.id = t.category_id
				LEFT JOIN categories p ON p.id = c.parent_id
				WHERE t.type = 'expense' AND (
					t.semester_fee_id IN (SELECT id FROM semester_fees f WHERE f.semester_id = s.id)
					OR (t.semester_fee_id IS NULL AND t.date BETWEEN s.start_date AND s.end_date
						AND (c.system = 'uni' OR p.system = 'uni')))), 0) AS spent
			FROM semesters s`)
	]);
	const spentBy = new Map(spent.map((r) => [r.id, r.spent]));
	return sems.map((s) => {
		const f = fees.filter((x) => x.semester_id === s.id);
		return {
			...s,
			fees: f,
			fees_total: f.reduce((a, x) => a + x.amount, 0),
			fees_paid: f.filter((x) => x.paid_txn_id).reduce((a, x) => a + x.amount, 0),
			spent: spentBy.get(s.id) ?? 0
		};
	});
}

export async function dues(accounts: Account[], windowDays: number, on = today()): Promise<{ dues: Due[]; cards: CardSummary[] }> {
	const until = addDays(on, windowDays);
	const out: Due[] = [];

	const [emis, fees, schemes] = await Promise.all([
		all<{ id: string; loan_id: string; seq: number; due_date: string; amount: number; name: string; tenure_months: number }>(
			`SELECT i.id, i.loan_id, i.seq, i.due_date, i.amount, l.name, l.tenure_months FROM loan_installments i
			 JOIN loans l ON l.id = i.loan_id
			 WHERE l.status = 'active' AND i.paid_date IS NULL AND i.due_date <= ?1 ORDER BY i.due_date`,
			until
		),
		all<{ id: string; label: string; amount: number; due_date: string; semester: string }>(
			`SELECT f.id, f.label, f.amount, f.due_date, s.name AS semester FROM semester_fees f
			 JOIN semesters s ON s.id = f.semester_id
			 WHERE f.paid_txn_id IS NULL AND f.due_date IS NOT NULL AND f.due_date <= ?1`,
			until
		),
		schemesWithProgress(monthKey(on))
	]);

	for (const e of emis) {
		out.push({
			kind: 'emi',
			ref_id: e.id,
			title: e.name,
			subtitle: `EMI ${e.seq}/${e.tenure_months}`,
			date: e.due_date,
			amount: e.amount,
			href: `/plan/loans/${e.loan_id}`,
			overdue: e.due_date < on
		});
	}
	for (const f of fees) {
		out.push({ kind: 'semester', ref_id: f.id, title: f.label, subtitle: f.semester, date: f.due_date, amount: f.amount, href: '/plan/uni', overdue: f.due_date < on });
	}
	for (const s of schemes) {
		if (s.type !== 'dps' || s.status !== 'active' || !s.monthly_amount || !s.installment_day) continue;
		const d = parseISO(on);
		const thisMonth = clampDay(d.getFullYear(), d.getMonth(), s.installment_day);
		const date = (s.paid_this_month ?? 0) >= s.monthly_amount ? clampDay(d.getFullYear(), d.getMonth() + 1, s.installment_day) : thisMonth;
		if (date <= until && date <= s.maturity_date && date >= s.start_date) {
			out.push({ kind: 'dps', ref_id: s.id, title: s.name, subtitle: 'DPS installment', date, amount: s.monthly_amount, href: '/plan/savings', overdue: date < on });
		}
	}

	const cards: CardSummary[] = [];
	for (const acc of accounts.filter((a) => a.type === 'card' && !a.archived)) {
		const c = await cardSummary(acc, on);
		if (!c) continue;
		cards.push(c);
		if (c.remaining > 0 && c.due_date <= until) {
			out.push({
				kind: 'card',
				ref_id: acc.id,
				title: acc.name,
				subtitle: `Statement · min ৳${Math.ceil(c.min_due / 100).toLocaleString('en-IN')}`,
				date: c.due_date,
				amount: c.remaining,
				href: `/accounts/${acc.id}`,
				overdue: c.due_date < on
			});
		}
	}

	out.sort((a, b) => a.date.localeCompare(b.date));
	return { dues: out, cards };
}

/** Expense filter that excludes loan principal movements. */
const REAL_EXPENSE = `t.type = 'expense' AND (c.system IS NULL OR c.system != 'loan')`;
const REAL_INCOME = `t.type = 'income' AND (c.system IS NULL OR c.system != 'loan')`;

export async function dashboard(month = monthKey(today())): Promise<Dashboard> {
	const { from, to } = monthRange(month);
	const on = today();
	const settings = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
	const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));
	const windowDays = Number(s.due_window_days ?? 30);

	const [accounts, loanOut, totals, byCat, daily, budgets, goals, recent] = await Promise.all([
		accountsWithBalances('9999-12-31', false),
		loanOutstanding(),
		first<{ income: number; expense: number }>(
			`SELECT COALESCE(SUM(CASE WHEN ${REAL_INCOME} THEN t.amount END), 0) AS income,
			        COALESCE(SUM(CASE WHEN ${REAL_EXPENSE} THEN t.amount END), 0) AS expense
			 FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
			 WHERE t.date BETWEEN ?1 AND ?2`,
			from,
			to
		),
		all<Dashboard['by_category'][number]>(
			`SELECT COALESCE(p.id, c.id, '_none') AS category_id, COALESCE(p.name, c.name, 'Uncategorised') AS name,
			        COALESCE(p.icon, c.icon) AS icon, COALESCE(p.color, c.color) AS color, SUM(t.amount) AS total
			 FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN categories p ON p.id = c.parent_id
			 WHERE ${REAL_EXPENSE} AND t.date BETWEEN ?1 AND ?2
			 GROUP BY 1 ORDER BY total DESC`,
			from,
			to
		),
		all<{ date: string; total: number }>(
			`SELECT t.date, SUM(t.amount) AS total FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
			 WHERE ${REAL_EXPENSE} AND t.date BETWEEN ?1 AND ?2 GROUP BY t.date ORDER BY t.date`,
			from,
			to
		),
		budgetProgress(month),
		goalsWithProgress(),
		all<Record<string, unknown>>(`SELECT * FROM transactions WHERE parent_id IS NULL ORDER BY date DESC, created_at DESC LIMIT 6`)
	]);

	const { dues: dueList, cards } = await dues(accounts, windowDays, on);
	const assets = accounts.filter((a) => (a.balance ?? 0) > 0).reduce((x, a) => x + (a.balance ?? 0), 0);
	const negatives = accounts.filter((a) => (a.balance ?? 0) < 0).reduce((x, a) => x - (a.balance ?? 0), 0);

	return {
		month,
		net_worth: assets - negatives - loanOut,
		assets,
		liabilities: negatives + loanOut,
		loan_outstanding: loanOut,
		accounts,
		income: totals?.income ?? 0,
		expense: totals?.expense ?? 0,
		by_category: byCat,
		daily,
		budgets,
		goals: goals.filter((g) => !g.archived),
		dues: dueList,
		cards,
		recent: recent.map(parseTxn),
		onboarded: s.onboarded === '1'
	};
}

export async function budgetProgress(month: string) {
	const { from, to } = monthRange(month);
	// A month-specific budget overrides the default (month IS NULL) for that category.
	return all<Dashboard['budgets'][number]>(
		`WITH eff AS (
			SELECT category_id, amount FROM budgets b WHERE month = ?3
			UNION ALL
			SELECT category_id, amount FROM budgets b WHERE month IS NULL
				AND NOT EXISTS (SELECT 1 FROM budgets o WHERE o.category_id = b.category_id AND o.month = ?3)
		)
		SELECT eff.category_id, c.name, c.icon, c.color, eff.amount AS "limit",
			COALESCE((SELECT SUM(t.amount) FROM transactions t LEFT JOIN categories tc ON tc.id = t.category_id
				WHERE t.type = 'expense' AND t.date BETWEEN ?1 AND ?2
				AND (t.category_id = eff.category_id OR tc.parent_id = eff.category_id)), 0) AS spent
		FROM eff JOIN categories c ON c.id = eff.category_id ORDER BY c.sort`,
		from,
		to,
		month
	);
}

export async function report(from: string, to: string) {
	const [monthly, byCat, byAccount] = await Promise.all([
		all<{ month: string; income: number; expense: number }>(
			`SELECT substr(t.date, 1, 7) AS month,
				COALESCE(SUM(CASE WHEN ${REAL_INCOME} THEN t.amount END), 0) AS income,
				COALESCE(SUM(CASE WHEN ${REAL_EXPENSE} THEN t.amount END), 0) AS expense
			 FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
			 WHERE t.date BETWEEN ?1 AND ?2 GROUP BY 1 ORDER BY 1`,
			from,
			to
		),
		all<{ category_id: string; name: string; icon: string | null; color: string | null; kind: string; total: number; count: number }>(
			`SELECT COALESCE(p.id, c.id, '_none') AS category_id, COALESCE(p.name, c.name, 'Uncategorised') AS name,
				COALESCE(p.icon, c.icon) AS icon, COALESCE(p.color, c.color) AS color, t.type AS kind,
				SUM(t.amount) AS total, COUNT(*) AS count
			 FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN categories p ON p.id = c.parent_id
			 WHERE ((${REAL_EXPENSE}) OR (${REAL_INCOME})) AND t.date BETWEEN ?1 AND ?2
			 GROUP BY 1, t.type ORDER BY total DESC`,
			from,
			to
		),
		all<{ account_id: string; name: string; expense: number }>(
			`SELECT a.id AS account_id, a.name, SUM(t.amount) AS expense
			 FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN categories c ON c.id = t.category_id
			 WHERE ${REAL_EXPENSE} AND t.date BETWEEN ?1 AND ?2 GROUP BY a.id ORDER BY expense DESC`,
			from,
			to
		)
	]);
	return { from, to, monthly, by_category: byCat, by_account: byAccount, semesters: await semestersWithFees() };
}
