# Horsemen Pick Club

Shared five-person parlay tracker. React/Vinext on a Cloudflare Worker with D1 persistence and Sites/ChatGPT sign-in. The app records picks, results and payouts; it does not place bets or transfer money.

## Run

`npm install`, then `npm run dev`. Generate migrations with `npm run db:generate`. Local D1 migrations must be applied to `.wrangler/state`. Build with `npm run build`. Run calculation checks with `node --experimental-strip-types --test scripts/league.test.ts` and type checks with `npx tsc --noEmit`.

## Access

The Site is initially owner-private. Daniel must initialize it while owner-private. The authenticated initializing user becomes commissioner. Do not share an uninitialized site. Configure each friend's ChatGPT email in Manage league, and add those same viewers in Sites sharing. Platform access and the application email allowlist both apply. Other members can only submit their own pick before the commissioner locks a week; only the commissioner may edit results, amounts and members. All writes use a revision check to prevent concurrent overwrites.

## Settlement

Default stake: $5 × 5 = $25. Losing picks split the stake; winning, pushed and absent picks incur no loss charge. Absences reduce the number contributing to the stake. Fully settled, loss-free parlays may have a payout. The commissioner enters the total parlay payout; the app divides it by five. Internally, payout stores the per-person share to preserve the original workbook's precision. Balances retain fractional-cent charges until display, matching the source workbook. Balances do not track payment status.

## Historical source

https://docs.google.com/spreadsheets/d/1F1arN3qtLVi55WoyE7aPR4fMEKjZvlK5seF5A4tPHk4/edit

Read-only XLSX export on 2026-09-07; 56 entries from 2022–2025. `lib/history.json` retains original pick text and backend loss flags; gray Oklahoma in 2025 is a push, Daniel's 2023 absence is excluded, and 2023 Ole Miss “push/win” remains a win as colored in the original. 2022 NFL parlays and $1/$2 buy-ins are preserved. All 20 year/member balances reconcile with cached source formulas to cents. The workbook's All Time P/L references empty row 24 of 2022 instead of actual totals in row 23, so its all-time amounts exclude 2022. This app includes all entries. Erik's 2025 push is not counted as a win, unlike the manually maintained All Time tally. The empty 2026 template contains 2024 dates and was excluded.

`lib/history-audit.json` contains reference balances; `scripts/import-history.py` recreates the import from `/tmp/horsemen-history.xlsx` using openpyxl for read-only extraction. Source Google Sheets custom color functions are preserved by importing their cached flags rather than trying to execute them.

## Verification

Production build and TypeScript check; arithmetic tests cover source reconciliation, zero through five losers, incomplete weeks and the four-person exception. WebMCP week navigation supports valid and invalid date checking. No broad browser visual QA was requested.
