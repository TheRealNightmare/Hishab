# Hishab ৳

A personal finance tracker for one person. It covers accounts (cash, bank, bKash/Nagad/Rocket, credit cards), salary and other income, daily spending, university semester fees, loans with EMI schedules (including the bKash digital loan), savings goals, DPS/FDR deposits, budgets and recurring entries.

- **Frontend**: SvelteKit 3 + Svelte 5, Tailwind v4. Neo-retro brutalist design in Gruvbox light. It's an installable PWA.
- **API**: SvelteKit `+server.ts` routes, running in the same Cloudflare Worker.
- **Database**: Cloudflare D1 (`hishab`). All money is stored as integer paisa.
- **Auth**: Cloudflare Access sits in front of `hishab.mirazulislamnahid.com`. The API also verifies the Access JWT, and refuses every request until `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set.
- **Hosting**: a Cloudflare Worker with static assets on the custom domain. `workers.dev` and preview URLs are disabled.

## Develop

```sh
npm install
npm run db:migrate:local   # creates the local D1 in .wrangler/
npm run dev                # http://localhost:5173 (.dev.vars sets DEV_BYPASS=1 to skip the Access check)
npm test                   # domain maths: EMI, card cycles, money, recurring
npm run check              # svelte-check + TypeScript
```

## Deploy

```sh
npm run db:migrate:remote  # only when migrations/ changed
npm run deploy             # build + wrangler deploy
```

## Cloudflare Access (one-time)

1. Go to **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Set the application domain to `hishab.mirazulislamnahid.com` and the session duration to whatever suits you (e.g. 1 month).
3. Add a policy with action **Allow**, include **Emails** → `nnahid929@gmail.com`. Login method: One-time PIN (or Google).
4. Save, then copy:
   - the **Application Audience (AUD) Tag** from the application's *Overview*
   - your **team domain** from *Settings → Custom Pages*, e.g. `yourteam.cloudflareaccess.com`
5. Put both into `wrangler.jsonc` → `vars` and run `npm run deploy`.

## Backups

- In the app: **More → Backup & export** gives you a JSON backup (restorable) or a transactions CSV.
- From the CLI: `npx wrangler d1 export hishab --remote --output backup.sql`
- D1 Time Travel can restore the database to any minute in the last 7 days (30 on the paid plan): `npx wrangler d1 time-travel restore hishab --timestamp=<ISO time>`

## How the money is modelled

- **Balance** = opening balance + income − expenses − transfers out + transfers in. It's always computed, never stored.
- **Credit cards** carry a negative balance when you owe money. A card purchase is an expense on the card, and paying the bill is a transfer from a bank or wallet to the card. The statement for each cycle is derived from the statement day and due day.
- **Loans**: the disbursement is booked as "Loan Received", and each EMI's principal as "Loan Repayment". Both are left out of income and expense reports. Interest is a real expense. Net worth subtracts the unpaid principal.
- **Transfer fees** (e.g. bKash cash-out) become a linked "Charges & Fees" expense on the source account.
- **Recurring rules** post automatically when the dashboard loads. The update is guarded, so a rule can't post twice.
- **Semester cost** = fees paid plus anything in the University category dated within the semester.
