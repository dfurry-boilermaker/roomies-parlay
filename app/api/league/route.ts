import { session } from '@/db/auth';
import { database } from '@/db/store';
import { type League, type Pick } from '@/lib/league';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function read() {
  return database()
    .prepare('SELECT data, revision FROM league_state WHERE id = ?')
    .bind('club')
    .first<{ data: string; revision: number }>();
}
export async function GET(req: Request) {
  try {
    const u = await session(req);
    if (!u)
      return json({
        identity: {
          admin: false,
          index: -1,
          initialized: false,
          signedIn: false,
        },
      });
    const row = await read();
    if (!row)
      return json({
        identity: {
          admin: false,
          index: -1,
          initialized: false,
          signedIn: true,
        },
      });
    const l: League = JSON.parse(row.data);
    const i = u.id;
    const admin = i === 0;
    return json({
      league: { ...l, owner: '', emails: [] },
      identity: { admin, index: i, initialized: true, signedIn: true },
    });
  } catch {
    return json({ error: 'Unable to load the league. Please try again.' }, 503);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return json({ error: 'Request origin is not allowed.' }, 403);
    const u = await session(req);
    if (!u) return json({ error: 'Sign in first.' }, 401);
    if (Number(req.headers.get('content-length') || 0) > 20000)
      return json({ error: 'Request too large.' }, 413);
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'Expected JSON.' }, 415);
    const raw = await req.text();
    if (raw.length > 20000) return json({ error: 'Request too large.' }, 413);
    const b = JSON.parse(raw) as Record<string, unknown>;
    const row = await read();
    if (!row) return json({ error: 'Initialize the league first.' }, 409);
    const l: League = JSON.parse(row.data);
    const i = u.id;
    const admin = i === 0;
    if (b.action !== 'pick' && !admin)
      return json(
        { error: 'Only Daniel can manage results and league settings.' },
        403,
      );
    const w = l.weeks.find((x) => x.date === b.date);
    if (b.action === 'pick') {
      if (!w || w.locked || w.picks.some((p) => p.result !== 'pending'))
        return json(
          { error: 'This week is locked or already has results.' },
          409,
        );
      if (
        typeof b.text !== 'string' ||
        !b.text.trim() ||
        b.text.trim().length > 100
      )
        return json(
          { error: 'Enter a pick between 1 and 100 characters.' },
          400,
        );
      w.picks[i] = { text: b.text.trim(), result: 'pending' };
    } else if (b.action === 'addWeek') {
      if (
        typeof b.date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
        Number.isNaN(Date.parse(b.date)) ||
        new Date(b.date).toISOString().slice(0, 10) !== b.date
      )
        return json({ error: 'Choose a valid date.' }, 400);
      if (w) return json({ error: 'That date already exists.' }, 409);
      l.weeks.push({
        date: b.date,
        buyIn: 5,
        payout: 0,
        locked: false,
        picks: Array.from({ length: 5 }, () => ({
          text: '',
          result: 'pending',
        })),
      });
      l.weeks.sort((a, b) => a.date.localeCompare(b.date));
    } else if (b.action === 'lock') {
      if (!w || typeof b.locked !== 'boolean')
        return json({ error: 'Choose a valid week.' }, 400);
      if (!b.locked && w.picks.some((p) => p.result !== 'pending'))
        return json(
          { error: 'Set all results to pending before reopening picks.' },
          409,
        );
      w.locked = b.locked;
    } else if (b.action === 'settle') {
      if (
        !w ||
        typeof b.buyIn !== 'number' ||
        typeof b.payout !== 'number' ||
        !Number.isFinite(b.buyIn) ||
        !Number.isFinite(b.payout) ||
        b.buyIn < 0 ||
        b.buyIn > 10000 ||
        b.payout < 0 ||
        b.payout > 200000 ||
        !Array.isArray(b.picks) ||
        b.picks.length !== 5
      )
        return json({ error: 'Check the week, amounts and five picks.' }, 400);
      const picks = b.picks as Pick[];
      if (
        picks.some(
          (p) =>
            typeof p.text !== 'string' ||
            p.text.length > 100 ||
            !['pending', 'win', 'loss', 'push', 'absent'].includes(p.result) ||
            (p.result !== 'pending' && !p.text.trim()),
        )
      )
        return json(
          { error: 'Each settled pick needs text and a valid result.' },
          400,
        );
      if (
        b.payout > 0 &&
        picks.some((p) => p.result === 'loss' || p.result === 'pending')
      )
        return json(
          {
            error:
              'A payout requires all parlay legs to be settled without a loss.',
          },
          400,
        );
      w.picks = picks;
      w.buyIn = b.buyIn;
      w.payout = b.payout;
      if (picks.some((p) => p.result !== 'pending')) w.locked = true;
    } else return json({ error: 'Unknown action.' }, 400);
    const updated = await database()
      .prepare(
        'UPDATE league_state SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
      )
      .bind(JSON.stringify(l), 'club', row.revision)
      .run();
    if (!updated.meta.changes)
      return json(
        { error: 'Another member just saved. Please try again.' },
        409,
      );
    return json({ ok: true });
  } catch {
    return json({ error: 'Could not save. Refresh and try again.' }, 400);
  }
}
