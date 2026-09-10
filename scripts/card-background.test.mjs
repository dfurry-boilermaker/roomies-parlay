import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = readFileSync(new URL('../lib/card-background.ts', import.meta.url), 'utf8');
const { cardBackground } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
test('12 consecutive season weeks receive 12 distinct, stable backgrounds', () => {
  const dates = Array.from({length:12}, (_, i) => new Date(Date.UTC(2026,7,29+i*7)).toISOString().slice(0,10));
  const paths = dates.map(date => cardBackground(date).src);
  assert.equal(new Set(paths).size,12);
  assert.equal(paths[0],'/card-backgrounds/01.png');
  assert.equal(cardBackground('2026-09-12').src,'/card-backgrounds/03.png');
  assert.deepEqual(cardBackground(dates[4]),cardBackground(dates[4]));
  assert.equal(cardBackground('2026-11-21').src,paths[0]);
});
