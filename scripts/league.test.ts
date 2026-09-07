import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Load pure settlement calculations without pulling any client-visible historical data.
const source = readFileSync(new URL('../lib/league.ts', import.meta.url), 'utf8');
const { stripTypeScriptTypes } = await import('node:module');
const mod = await import(
  'data:text/javascript;base64,' +
    Buffer.from(stripTypeScriptTypes(source)).toString('base64')
);
const { balance, settlement } = mod;
const historical = JSON.parse(
  readFileSync(new URL('../lib/history.json', import.meta.url), 'utf8'),
);
const audit = JSON.parse(
  readFileSync(new URL('../lib/history-audit.json', import.meta.url), 'utf8'),
);
test('All 20 season balances reconcile with cached workbook formulas', () => {
  for (const [year, entry] of Object.entries(audit) as [
    string,
    { weeks: number; balances: number[] },
  ][]) {
    const weeks = historical.filter((w: any) => w.date.startsWith(year));
    assert.equal(weeks.length, entry.weeks);
    entry.balances.forEach((n, i) =>
      assert.equal(Number(balance(weeks, i).toFixed(2)), n),
    );
  }
});
test('Losers split stake for 1–5 losing legs, with no divide by zero', () => {
  for (let n = 0; n <= 5; n++) {
    const w = {
      buyIn: 5,
      payout: 0,
      picks: Array.from({ length: 5 }, (_, i) => ({
        text: 'Pick',
        result: i < n ? 'loss' : 'win',
      })),
    };
    assert.equal(settlement(w).charge, n ? 25 / n : 0);
  }
});
test('Pending weeks do not affect balances', () => {
  const w = {
    buyIn: 5,
    payout: 20,
    picks: Array.from({ length: 5 }, () => ({
      text: 'Pick',
      result: 'pending',
    })),
  };
  assert.equal(settlement(w).complete, false);
  assert.equal(balance([w], 0), 0);
});
test('Four-person historical week charges $20 and excludes Daniel', () => {
  const w = historical.find((w: any) => w.date === '2023-09-09');
  assert.equal(settlement(w).charge, 20);
  assert.equal(balance([w], 0), 0);
  assert.equal(balance([w], 3), -20);
});
