# Roomies Parlay

Shared five-person parlay tracker. React/Vinext on a Cloudflare Worker with D1 persistence and member PIN/password sign-in. The app records picks, results and payouts; it does not place bets or transfer money.

## Run

`npm install`, then `npm run dev`. Generate migrations with `npm run db:generate`. Local D1 migrations must be applied to `.wrangler/state`. Build with `npm run build`. Run calculation checks with `node --experimental-strip-types --test scripts/league.test.ts` and type checks with `npx tsc --noEmit`.

## Access

Choose a member name and enter that member’s PIN or password. The app owns authentication; ChatGPT identity is not used. The login page may be public, but all league data is loaded only after a valid member session. Historical data is server-only and absent from public client assets. Member zero (Daniel) is the commissioner; other members can only submit their own pick before the commissioner locks a week.

Starting member credentials come from the secret `INITIAL_MEMBERS` (JSON array of five salt/hash pairs) and separate secret `AUTH_PEPPER`. Both are provisioned outside source control. Passwords use PBKDF2-HMAC-SHA256 (100,000 iterations for the Workers runtime), per-member salts, and a server-side pepper. User-requested four-digit PINs have limited entropy; durable account and IP throttling restrict guessing to five attempts per member in 15 minutes. Members may change to a longer password. Daniel can reset another member’s credential. Changes invalidate all sessions for that member. Session cookies are HttpOnly, SameSite=Strict and Secure over HTTPS; the database stores only token hashes, with 30-day expiration. State mutations reject cross-origin requests and require JSON. All league writes use a revision check to prevent concurrent overwrites.

Store local credentials only in ignored `.dev.vars`; never use the local test PINs in production. `scripts/configure-test-auth.mjs` generates test-only seed credentials; `scripts/auth.integration.mjs` exercises them against a fresh local DB. Do not run that generator over a configured development environment unless intentionally replacing local test credentials. Production credentials and records are separate from local D1 state. There is no public registration or credential recovery bypass. PIN reset for Daniel requires owner-authorized database maintenance.

The Sites audience must allow anonymous access to the login page for friends to use these credentials without an additional platform sign-in. Change platform access only after validating the application gate and obtaining any required publication approval.

## Settlement

Default stake: $5 × 5 = $25. Losing picks split the stake; winning, pushed and absent picks incur no loss charge. Absences reduce the number contributing to the stake. Fully settled, loss-free parlays may have a payout. The commissioner enters the total parlay payout; the app divides it by five. Internally, payout stores the per-person share to preserve the original workbook's precision. Balances retain fractional-cent charges until display, matching the source workbook. Balances do not track payment status.

## Historical source

https://docs.google.com/spreadsheets/d/1F1arN3qtLVi55WoyE7aPR4fMEKjZvlK5seF5A4tPHk4/edit

Read-only XLSX export on 2026-09-07; 56 entries from 2022–2025. `lib/history.json` retains original pick text and backend loss flags; gray Oklahoma in 2025 is a push, Daniel's 2023 absence is excluded, and 2023 Ole Miss “push/win” remains a win as colored in the original. 2022 NFL parlays and $1/$2 buy-ins are preserved. All 20 year/member balances reconcile with cached source formulas to cents. The workbook's All Time P/L references empty row 24 of 2022 instead of actual totals in row 23, so its all-time amounts exclude 2022. This app includes all entries. Erik's 2025 push is not counted as a win, unlike the manually maintained All Time tally. The empty 2026 template contains 2024 dates and was excluded.

## Automatic scoring

The Sunday and Monday GitHub workflow calls the protected `/api/cron/score` endpoint. It grades completed games from ESPN's public college-football scoreboard for the normal entry styles `Team -3.5` and `Team A/Team B U47.5` (or `O47.5`). It leaves unknown or ambiguous team names pending for Daniel to review. A perfect parlay's payout remains a commissioner-entered amount because the sportsbook payout is not available from final scores.

Set the same random `ROOMIES_CRON_SECRET` value in the Site runtime environment and the GitHub repository's Actions secrets before enabling the workflow.

`lib/history-audit.json` contains reference balances; `scripts/import-history.py` recreates the import from `/tmp/horsemen-history.xlsx` using openpyxl for read-only extraction. Source Google Sheets custom color functions are preserved by importing their cached flags rather than trying to execute them.

## Verification

Production build and TypeScript check; arithmetic tests cover source reconciliation, zero through five losers, incomplete weeks and the four-person exception. WebMCP week navigation supports valid and invalid date checking. HTTP integration checks cover login, member ownership, commissioner authorization, locked picks, origin rejection, password changes, session revocation, password resets, throttling and logout. No broad browser visual QA was requested.
