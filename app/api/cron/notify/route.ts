import { env } from 'cloudflare:workers';
import { database } from '@/db/store';
import { names, type League } from '@/lib/league';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const config = env as unknown as { ROOMIES_CRON_SECRET?: string };

function authorized(request: Request) {
  const expected = config.ROOMIES_CRON_SECRET;
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: 'Unauthorized.' }, 401);
  try {
    const row = await database()
      .prepare('SELECT data FROM league_state WHERE id = ?')
      .bind('club')
      .first<{ data: string }>();
    if (!row) return json({ error: 'League is not initialized.' }, 409);
    const league = JSON.parse(row.data) as League;
    const notified = new Set(league.notifiedWeeks || []);
    const week = league.weeks.at(-1);
    if (!week || notified.has(week.date) || week.picks.some((pick) => !pick.text))
      return json({ shouldNotify: false });
    return json({
      shouldNotify: true,
      week: {
        date: week.date,
        buyIn: week.buyIn,
        picks: week.picks.map((pick, index) => ({ name: names[index], text: pick.text })),
      },
    });
  } catch {
    return json({ error: 'Could not read the league.' }, 503);
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: 'Unauthorized.' }, 401);
  try {
    const body = (await request.json()) as { date?: unknown };
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
      return json({ error: 'A valid week date is required.' }, 400);
    const row = await database()
      .prepare('SELECT data, revision FROM league_state WHERE id = ?')
      .bind('club')
      .first<{ data: string; revision: number }>();
    if (!row) return json({ error: 'League is not initialized.' }, 409);
    const league = JSON.parse(row.data) as League;
    const week = league.weeks.find((candidate) => candidate.date === body.date);
    if (!week || week.picks.some((pick) => !pick.text))
      return json({ error: 'All five picks must be submitted first.' }, 409);
    const notified = new Set(league.notifiedWeeks || []);
    if (notified.has(body.date)) return json({ ok: true, alreadyNotified: true });
    notified.add(body.date);
    league.notifiedWeeks = [...notified].sort();
    const updated = await database()
      .prepare('UPDATE league_state SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
      .bind(JSON.stringify(league), 'club', row.revision)
      .run();
    if (!updated.meta.changes) return json({ error: 'League changed; run again.' }, 409);
    return json({ ok: true });
  } catch {
    return json({ error: 'Could not mark the notification as sent.' }, 400);
  }
}
