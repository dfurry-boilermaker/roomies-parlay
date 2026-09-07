import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { historical, type League, type Pick } from '@/lib/league';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function read() {
  return database()
    .prepare('SELECT data, revision FROM league_state WHERE id = ?')
    .bind('club')
    .first<{ data: string; revision: number }>();
}
function member(l: League, u: { userId: string; email: string }) {
  return l.owner === u.userId
    ? 0
    : l.emails.findIndex((e) => e !== '' && e === u.email.toLowerCase());
}
export async function GET() {
  try {
    const u = await getChatGPTUser();
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
    const i = member(l, u);
    if (i < 0)
      return json(
        { error: 'Daniel needs to add your account email to the league.' },
        403,
      );
    const admin = l.owner === u.userId;
    return json({
      league: { ...l, owner: '', emails: admin ? l.emails : [] },
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
    const u = await getChatGPTUser();
    if (!u) return json({ error: 'Sign in first.' }, 401);
    if (Number(req.headers.get('content-length') || 0) > 20000)
      return json({ error: 'Request too large.' }, 413);
    const b = (await req.json()) as Record<string, unknown>;
    const row = await read();
    if (b.action === 'initialize') {
      if (u.email.toLowerCase() !== 'danielfurry22@gmail.com') return json({error:'Only Daniel can initialize this league.'},403);
      if (row)
        return json({ error: 'The league is already initialized.' }, 409);
      const l: League = {
        owner: u.userId,
        emails: [u.email.toLowerCase(), '', '', '', ''],
        weeks: historical,
      };
      await database()
        .prepare('INSERT INTO league_state (id,data,revision) VALUES (?,?,0)')
        .bind('club', JSON.stringify(l))
        .run();
      return json({ ok: true });
    }
    if (!row) return json({ error: 'Initialize the league first.' }, 409);
    const l: League = JSON.parse(row.data);
    const i = member(l, u);
    if (i < 0)
      return json(
        { error: 'Only invited members can access this league.' },
        403,
      );
    const admin = l.owner === u.userId;
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
    } else if (b.action === 'invite') {
      if (!Array.isArray(b.emails) || b.emails.length !== 5)
        return json({ error: 'Provide the four member emails.' }, 400);
      const emails = [
        u.email.toLowerCase(),
        ...b.emails.slice(1).map((e) => String(e).trim().toLowerCase()),
      ];
      if (
        emails.some((e) => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) ||
        new Set(emails.filter(Boolean)).size !== emails.filter(Boolean).length
      )
        return json(
          { error: 'Use valid, unique emails for each friend.' },
          400,
        );
      l.emails = emails;
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
