/** Tables in FK-safe insert order (parents before children). */
export const EXPORT_TABLES = [
	'settings',
	'accounts',
	'categories',
	'semesters',
	'semester_fees',
	'loans',
	'loan_installments',
	'goals',
	'schemes',
	'recurring',
	'transactions',
	'budgets'
] as const;
