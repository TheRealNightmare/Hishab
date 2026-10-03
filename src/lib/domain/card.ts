import { clampDay, parseISO, addDays } from './dates';

export interface CardCycle {
	/** Last closed statement period (inclusive) */
	period_start: string;
	period_end: string;
	/** Due date for that statement */
	due_date: string;
	/** Next statement closing date */
	next_close: string;
}

/**
 * Work out the most recent closed statement cycle for a card that closes on
 * `statementDay` and is due on `dueDay` (the due day falls in the month after
 * closing when dueDay <= statementDay, otherwise the same month).
 */
export function cardCycle(statementDay: number, dueDay: number, on: string): CardCycle {
	const d = parseISO(on);
	const y = d.getFullYear();
	const m = d.getMonth();
	const closeThisMonth = clampDay(y, m, statementDay);
	// Statement closes at end of statement day; "on" that day the cycle is closed.
	const periodEnd = on >= closeThisMonth ? closeThisMonth : clampDay(y, m - 1, statementDay);
	const pe = parseISO(periodEnd);
	const prevClose = clampDay(pe.getFullYear(), pe.getMonth() - 1, statementDay);
	const dueMonthOffset = dueDay > statementDay ? 0 : 1;
	const due = clampDay(pe.getFullYear(), pe.getMonth() + dueMonthOffset, dueDay);
	const nextClose = clampDay(pe.getFullYear(), pe.getMonth() + 1, statementDay);
	return { period_start: addDays(prevClose, 1), period_end: periodEnd, due_date: due, next_close: nextClose };
}

export interface CardStatement extends CardCycle {
	/** Amount owed at statement close (positive paisa) */
	statement_amount: number;
	/** Payments (inflows) received after statement close */
	paid_since: number;
	/** What's still due for this statement */
	remaining: number;
	min_due: number;
	/** Current outstanding (positive = owed) */
	outstanding: number;
}

/**
 * @param balanceAtClose card balance (signed; negative = owed) at end of period_end
 * @param inflowSinceClose total payments/refunds credited after close up to today
 * @param currentBalance current signed balance
 */
export function cardStatement(
	cycle: CardCycle,
	balanceAtClose: number,
	inflowSinceClose: number,
	currentBalance: number,
	minDuePct = 5,
	minDueFloor = 50000
): CardStatement {
	const statement_amount = Math.max(0, -balanceAtClose);
	const remaining = Math.max(0, statement_amount - inflowSinceClose);
	const min = statement_amount === 0 ? 0 : Math.min(statement_amount, Math.max(minDueFloor, Math.round((statement_amount * minDuePct) / 100)));
	return {
		...cycle,
		statement_amount,
		paid_since: inflowSinceClose,
		remaining,
		min_due: Math.max(0, min - inflowSinceClose),
		outstanding: Math.max(0, -currentBalance)
	};
}
