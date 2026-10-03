import { addMonths } from './dates';

export type LoanMethod = 'reducing' | 'flat';

export interface ScheduleRow {
	seq: number;
	due_date: string;
	principal: number;
	interest: number;
	amount: number;
}

export interface LoanTerms {
	principal: number; // paisa
	annual_rate: number; // percent, e.g. 9 for 9%
	tenure_months: number;
	method: LoanMethod;
	start_date: string; // first installment due date
}

/** Standard reducing-balance EMI in paisa (unrounded). */
export function emiAmount(principal: number, annualRate: number, months: number): number {
	const r = annualRate / 12 / 100;
	if (r === 0) return principal / months;
	const f = Math.pow(1 + r, months);
	return (principal * r * f) / (f - 1);
}

/**
 * Build the installment schedule. All rows are whole paisa; the rounding remainder
 * goes into the last installment so principal sums exactly to the loan amount.
 */
export function buildSchedule(t: LoanTerms): ScheduleRow[] {
	const n = t.tenure_months;
	const rows: ScheduleRow[] = [];
	const anchor = Number(t.start_date.slice(8, 10));

	if (t.method === 'flat') {
		const totalInterest = Math.round((t.principal * t.annual_rate * n) / 12 / 100);
		const p = Math.floor(t.principal / n);
		const i = Math.floor(totalInterest / n);
		for (let k = 0; k < n; k++) {
			const last = k === n - 1;
			const principal = last ? t.principal - p * (n - 1) : p;
			const interest = last ? totalInterest - i * (n - 1) : i;
			rows.push({ seq: k + 1, due_date: addMonths(t.start_date, k, anchor), principal, interest, amount: principal + interest });
		}
		return rows;
	}

	const r = t.annual_rate / 12 / 100;
	const emi = Math.round(emiAmount(t.principal, t.annual_rate, n));
	let balance = t.principal;
	for (let k = 0; k < n; k++) {
		const last = k === n - 1;
		const interest = Math.round(balance * r);
		const principal = last ? balance : Math.min(balance, emi - interest);
		balance -= principal;
		rows.push({ seq: k + 1, due_date: addMonths(t.start_date, k, anchor), principal, interest, amount: principal + interest });
	}
	return rows;
}

export function scheduleTotals(rows: ScheduleRow[]) {
	return rows.reduce(
		(acc, r) => ({ principal: acc.principal + r.principal, interest: acc.interest + r.interest, amount: acc.amount + r.amount }),
		{ principal: 0, interest: 0, amount: 0 }
	);
}
