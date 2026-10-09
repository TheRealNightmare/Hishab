import { describe, expect, it } from 'vitest';
import { formatBDT, formatCompact, toPaisa } from './money';
import { addMonths, clampDay, monthRange } from './dates';
import { buildSchedule, emiAmount, scheduleTotals } from './emi';
import { cardCycle, cardStatement } from './card';
import { dueOccurrences } from './recurring';
import { categoryDeltas, noSpendDays, pctChange, previousPeriod, projectMonthEnd, savingsRate } from './insights';
import { debtTotals, personBalance } from './debt';

describe('money', () => {
	it('formats with lakh grouping', () => {
		expect(formatBDT(12500000)).toBe('৳1,25,000');
		expect(formatBDT(1234567850)).toBe('৳1,23,45,678.50');
		expect(formatBDT(-50000)).toBe('−৳500');
		expect(formatBDT(50000, { sign: true })).toBe('+৳500');
		expect(formatBDT(150, { decimals: true })).toBe('৳1.50');
	});
	it('parses user input', () => {
		expect(toPaisa('1,25,000')).toBe(12500000);
		expect(toPaisa('৳ 99.99')).toBe(9999);
		expect(toPaisa('abc')).toBeNull();
		expect(toPaisa('')).toBeNull();
		expect(toPaisa(0.1 + 0.2)).toBe(30);
	});
	it('compacts', () => {
		expect(formatCompact(12500000)).toBe('৳1.3L');
		expect(formatCompact(350000000)).toBe('৳35L');
		expect(formatCompact(3500000000)).toBe('৳3.5Cr');
		expect(formatCompact(1250000)).toBe('৳12.5K');
	});
});

describe('dates', () => {
	it('clamps month ends', () => {
		expect(clampDay(2026, 1, 31)).toBe('2026-02-28');
		expect(clampDay(2028, 1, 31)).toBe('2028-02-29');
		expect(clampDay(2026, 12, 5)).toBe('2027-01-05');
	});
	it('adds months anchored', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2026-01-31', 2, 31)).toBe('2026-03-31');
	});
	it('month range', () => {
		expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
	});
});

describe('emi', () => {
	it('matches the textbook EMI', () => {
		// ৳1,00,000 at 12% for 12 months → ৳8,884.88
		expect(Math.round(emiAmount(10000000, 12, 12))).toBe(888488);
	});
	it('reducing schedule sums to principal exactly', () => {
		const rows = buildSchedule({ principal: 10000000, annual_rate: 12, tenure_months: 12, method: 'reducing', start_date: '2026-01-31' });
		const t = scheduleTotals(rows);
		expect(rows).toHaveLength(12);
		expect(t.principal).toBe(10000000);
		expect(rows[0].interest).toBe(100000); // 1% of 1 lakh
		expect(rows[0].amount).toBe(888488);
		expect(rows[1].due_date).toBe('2026-02-28');
		expect(rows[2].due_date).toBe('2026-03-31');
		expect(Math.abs(rows[11].amount - 888488)).toBeLessThan(100);
	});
	it('bKash-style short loan: ৳10,000 at 9% for 3 months', () => {
		const rows = buildSchedule({ principal: 1000000, annual_rate: 9, tenure_months: 3, method: 'reducing', start_date: '2026-10-15' });
		expect(scheduleTotals(rows).principal).toBe(1000000);
		expect(rows.map((r) => r.due_date)).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
		expect(scheduleTotals(rows).interest).toBe(15038); // EMI ৳3,383.48 → ≈ ৳150.4 interest
	});
	it('flat schedule', () => {
		const rows = buildSchedule({ principal: 1000000, annual_rate: 12, tenure_months: 3, method: 'flat', start_date: '2026-10-01' });
		const t = scheduleTotals(rows);
		expect(t.principal).toBe(1000000);
		expect(t.interest).toBe(30000);
	});
	it('zero interest', () => {
		const rows = buildSchedule({ principal: 1000000, annual_rate: 0, tenure_months: 3, method: 'reducing', start_date: '2026-10-01' });
		expect(rows.map((r) => r.amount)).toEqual([333333, 333333, 333334]);
	});
});

describe('card', () => {
	it('cycle before statement day uses last month close', () => {
		const c = cardCycle(20, 5, '2026-10-03');
		expect(c).toEqual({ period_start: '2026-08-21', period_end: '2026-09-20', due_date: '2026-10-05', next_close: '2026-10-20' });
	});
	it('cycle on/after statement day', () => {
		const c = cardCycle(20, 5, '2026-10-20');
		expect(c.period_end).toBe('2026-10-20');
		expect(c.due_date).toBe('2026-11-05');
	});
	it('due day later in same month', () => {
		const c = cardCycle(5, 25, '2026-10-10');
		expect(c.period_end).toBe('2026-10-05');
		expect(c.due_date).toBe('2026-10-25');
	});
	it('statement crossing year end with day 31', () => {
		const c = cardCycle(31, 15, '2027-01-10');
		expect(c.period_start).toBe('2026-12-01');
		expect(c.period_end).toBe('2026-12-31');
		expect(c.due_date).toBe('2027-01-15');
	});
	it('statement amounts', () => {
		const c = cardCycle(20, 5, '2026-10-03');
		const s = cardStatement(c, -2000000, 500000, -2300000, 5);
		expect(s.statement_amount).toBe(2000000);
		expect(s.remaining).toBe(1500000);
		expect(s.min_due).toBe(0); // 5% = 1,00,000 paisa, already paid 5,00,000
		expect(s.outstanding).toBe(2300000);
	});
});

describe('recurring', () => {
	it('catches up missed months and anchors day', () => {
		const r = dueOccurrences('2026-07-31', 'monthly', '2026-10-03', 31);
		expect(r.dates).toEqual(['2026-07-31', '2026-08-31', '2026-09-30']);
		expect(r.next).toBe('2026-10-31');
	});
	it('nothing due', () => {
		expect(dueOccurrences('2026-11-01', 'monthly', '2026-10-03').dates).toEqual([]);
	});
	it('weekly', () => {
		expect(dueOccurrences('2026-09-20', 'weekly', '2026-10-03').dates).toEqual(['2026-09-20', '2026-09-27']);
	});
});

describe('insights', () => {
	it('percent change', () => {
		expect(pctChange(1200, 1000)).toBe(20);
		expect(pctChange(820, 1000)).toBe(-18);
		expect(pctChange(500, 0)).toBeNull();
	});
	it('projects month end', () => {
		expect(projectMonthEnd(1000000, 10, 30)).toBe(3000000);
		expect(projectMonthEnd(500, 0, 30)).toBe(500);
		expect(projectMonthEnd(3100, 40, 31)).toBe(3100);
	});
	it('category deltas, biggest change first', () => {
		const d = categoryDeltas(
			[
				{ category_id: 'food', name: 'Food', icon: null, total: 5000 },
				{ category_id: 'fun', name: 'Fun', icon: null, total: 1000 }
			],
			[
				{ category_id: 'food', name: 'Food', icon: null, total: 4000 },
				{ category_id: 'rent', name: 'Rent', icon: null, total: 3000 },
				{ category_id: 'fun', name: 'Fun', icon: null, total: 1000 }
			]
		);
		expect(d.map((x) => [x.category_id, x.delta])).toEqual([
			['rent', -3000],
			['food', 1000]
		]);
	});
	it('no-spend days', () => {
		const daily = [
			{ date: '2026-10-01', total: 100 },
			{ date: '2026-10-03', total: 50 },
			{ date: '2026-10-09', total: 10 }
		];
		expect(noSpendDays(daily, '2026-10-01', '2026-10-05')).toBe(3);
		expect(noSpendDays([], '2026-10-05', '2026-10-01')).toBe(0);
	});
	it('savings rate', () => {
		expect(savingsRate(10000, 7500)).toBe(25);
		expect(savingsRate(0, 100)).toBeNull();
	});
	it('previous period of equal length', () => {
		expect(previousPeriod('2026-10-01', '2026-10-31')).toEqual({ from: '2026-08-31', to: '2026-09-30' });
		expect(previousPeriod('2026-03-01', '2026-03-10')).toEqual({ from: '2026-02-19', to: '2026-02-28' });
	});
});

describe('debt', () => {
	it('lent 500, got 200 back → they owe 300', () => {
		expect(
			personBalance([
				{ type: 'expense', amount: 50000 },
				{ type: 'income', amount: 20000 }
			])
		).toBe(30000);
	});
	it('borrowed 1000, paid back 400 → you owe 600', () => {
		expect(
			personBalance([
				{ type: 'income', amount: 100000 },
				{ type: 'expense', amount: 40000 }
			])
		).toBe(-60000);
	});
	it('splits totals', () => {
		expect(debtTotals([30000, -60000, 0, 5000])).toEqual({ owed_to_me: 35000, i_owe: 60000 });
	});
});
