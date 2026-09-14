import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../lib/auto-score.ts', import.meta.url), 'utf8');
const { stripTypeScriptTypes } = await import('node:module');
const mod = await import(
  'data:text/javascript;base64,' +
    Buffer.from(stripTypeScriptTypes(source)).toString('base64'),
);
const { gradePick } = mod;

const games = [{
  completed: true,
  home: { name: 'North Carolina Tar Heels', shortName: 'North Carolina', abbreviation: 'UNC', score: 21 },
  away: { name: 'TCU Horned Frogs', shortName: 'TCU', abbreviation: 'TCU', score: 28 },
}];

test('scores totals in either direction', () => {
  assert.equal(gradePick('TCU/UNC U50.5', games), 'win');
  assert.equal(gradePick('UNC/TCU O48.5', games), 'win');
});

test('scores a spread and returns null when the game is unknown', () => {
  assert.equal(gradePick('TCU -3.5', games), 'win');
  assert.equal(gradePick('Virginia -3.5', games), null);
});

test('scores straight-up, money line, and money line wording', () => {
  assert.equal(gradePick('TCU', games), 'win');
  assert.equal(gradePick('TCU ML', games), 'win');
  assert.equal(gradePick('TCU Money Line', games), 'win');
  assert.equal(gradePick('UNC', games), 'loss');
});

test('scores shorthand totals against the closing line and ignores notes', () => {
  const game = [{
    ...games[0],
    closingTotal: 45.5,
  }];
  assert.equal(gradePick('TCU UNC Over', game), 'win');
  assert.equal(gradePick('TCU -3.5 (or spread if moves)', game), 'win');
});
