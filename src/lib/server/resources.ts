import type { z } from 'zod';
import { all } from './db';
import { accountsWithBalances, goalsWithProgress, schemesWithProgress, semestersWithFees } from './queries';
import { accountSchema, budgetSchema, categorySchema, goalSchema, recurringSchema, schemeSchema, semesterFeeSchema, semesterSchema } from './schemas';

interface Resource {
	table: string;
	prefix: string;
	schema: z.ZodObject;
	list: () => Promise<unknown[]>;
}

/** Simple CRUD resources served by /api/[resource] and /api/[resource]/[id]. */
export const resources: Record<string, Resource> = {
	accounts: { table: 'accounts', prefix: 'acc', schema: accountSchema, list: () => accountsWithBalances() },
	categories: {
		table: 'categories',
		prefix: 'cat',
		schema: categorySchema,
		list: () => all('SELECT * FROM categories ORDER BY kind DESC, archived, sort, name')
	},
	semesters: { table: 'semesters', prefix: 'sem', schema: semesterSchema, list: () => semestersWithFees() },
	'semester-fees': {
		table: 'semester_fees',
		prefix: 'fee',
		schema: semesterFeeSchema,
		list: () => all('SELECT * FROM semester_fees ORDER BY due_date')
	},
	goals: { table: 'goals', prefix: 'goal', schema: goalSchema, list: () => goalsWithProgress() },
	schemes: { table: 'schemes', prefix: 'sch', schema: schemeSchema, list: () => schemesWithProgress() },
	budgets: { table: 'budgets', prefix: 'bud', schema: budgetSchema, list: () => all('SELECT * FROM budgets') },
	recurring: {
		table: 'recurring',
		prefix: 'rec',
		schema: recurringSchema,
		list: async () =>
			(await all<Record<string, unknown>>('SELECT * FROM recurring ORDER BY active DESC, next_date')).map((r) => ({
				...r,
				template: JSON.parse(r.template as string)
			}))
	}
};
