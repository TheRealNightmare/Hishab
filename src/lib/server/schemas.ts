import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const money = z.number().int();
const positive = z.number().int().positive();
const day = z.number().int().min(1).max(31);
const optId = z.string().min(1).nullable().optional();
const optText = z.string().trim().max(500).nullable().optional();

export const accountSchema = z.object({
	name: z.string().trim().min(1).max(60),
	type: z.enum(['cash', 'bank', 'wallet', 'card', 'savings']),
	provider: optText,
	opening_balance: money.default(0),
	credit_limit: money.nullable().optional(),
	statement_day: day.nullable().optional(),
	due_day: day.nullable().optional(),
	min_due_pct: z.number().min(0).max(100).nullable().optional(),
	color: optText,
	archived: z.number().int().min(0).max(1).optional(),
	sort: z.number().int().optional()
});

export const categorySchema = z.object({
	name: z.string().trim().min(1).max(40),
	kind: z.enum(['income', 'expense']),
	icon: optText,
	color: optText,
	parent_id: optId,
	archived: z.number().int().min(0).max(1).optional(),
	sort: z.number().int().optional()
});

export const semesterSchema = z.object({
	name: z.string().trim().min(1).max(60),
	start_date: isoDate,
	end_date: isoDate
});

export const semesterFeeSchema = z.object({
	semester_id: z.string().min(1),
	label: z.string().trim().min(1).max(60),
	amount: positive,
	due_date: isoDate.nullable().optional()
});

export const goalSchema = z.object({
	name: z.string().trim().min(1).max(60),
	target: positive,
	deadline: isoDate.nullable().optional(),
	account_id: optId,
	color: optText,
	archived: z.number().int().min(0).max(1).optional()
});

export const schemeSchema = z.object({
	type: z.enum(['dps', 'fdr']),
	name: z.string().trim().min(1).max(60),
	bank: optText,
	account_id: optId,
	monthly_amount: positive.nullable().optional(),
	principal: positive.nullable().optional(),
	annual_rate: z.number().min(0).max(100).nullable().optional(),
	start_date: isoDate,
	maturity_date: isoDate,
	expected_maturity: positive.nullable().optional(),
	installment_day: day.nullable().optional(),
	status: z.enum(['active', 'matured', 'closed']).optional()
});

export const budgetSchema = z.object({
	category_id: z.string().min(1),
	amount: positive,
	month: z
		.string()
		.regex(/^\d{4}-\d{2}$/)
		.nullable()
		.optional()
});

export const templateSchema = z.object({
	type: z.enum(['income', 'expense', 'transfer']),
	amount: positive,
	account_id: z.string().min(1),
	to_account_id: optId,
	category_id: optId,
	note: optText,
	tags: z.array(z.string().trim().min(1).max(30)).max(10).optional()
});

export const recurringSchema = z.object({
	name: z.string().trim().min(1).max(60),
	template: templateSchema,
	freq: z.enum(['monthly', 'weekly']),
	day: day.nullable().optional(),
	next_date: isoDate,
	active: z.number().int().min(0).max(1).optional()
});

export const txnSchema = z
	.object({
		date: isoDate,
		type: z.enum(['income', 'expense', 'transfer']),
		amount: positive,
		account_id: z.string().min(1),
		to_account_id: optId,
		category_id: optId,
		fee: z.number().int().min(0).default(0),
		note: optText,
		tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
		goal_id: optId,
		scheme_id: optId,
		person_id: optId
	})
	.refine((t) => t.type !== 'transfer' || (t.to_account_id && t.to_account_id !== t.account_id), {
		message: 'Transfer needs a different destination account',
		path: ['to_account_id']
	});

export const personSchema = z.object({
	name: z.string().trim().min(1).max(60),
	phone: optText,
	note: optText,
	archived: z.number().int().min(0).max(1).optional()
});

export const loanSchema = z.object({
	name: z.string().trim().min(1).max(60),
	lender: optText,
	principal: positive,
	annual_rate: z.number().min(0).max(100),
	tenure_months: z.number().int().min(1).max(480),
	method: z.enum(['reducing', 'flat']).default('reducing'),
	processing_fee: z.number().int().min(0).default(0),
	start_date: isoDate,
	note: optText,
	/** Account the money landed in. Omit for loans taken before using Hishab. */
	disburse_account_id: optId,
	disbursed_on: isoDate.optional(),
	/** For existing loans: how many installments are already paid */
	paid_installments: z.number().int().min(0).default(0)
});

export const loanPatchSchema = z.object({
	name: z.string().trim().min(1).max(60).optional(),
	lender: optText,
	note: optText,
	status: z.enum(['active', 'closed']).optional()
});

export const payInstallmentSchema = z.object({
	installment_id: z.string().min(1),
	account_id: z.string().min(1),
	date: isoDate
});

export const payFeeSchema = z.object({
	account_id: z.string().min(1),
	date: isoDate
});

export const settingsSchema = z.record(z.string().max(40), z.string().max(500));
