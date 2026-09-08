import { env } from 'cloudflare:workers';
import { database } from '@/db/store';
import { settleAvailablePicks, type FinalGame } from '@/lib/auto-score';
import type { League } from '@/lib/league';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const config = env as unknown as { ROOMIES_CRON_SECRET?: string };

type EspnEvent = {
  status?: { type?: { completed?: boolean } };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: 'home' | 'away';
      score?: string;
      team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
    }>;
  }>;
};

async function scoreboard(date: string): Promise<FinalGame[]> {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date.replaceAll('-', '')}&limit=1000`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw Error('Scoreboard provider is unavailable.');
  const body = (await response.json()) as { events?: EspnEvent[] };
  return (body.events || []).flatMap((event) => {
    const competitors = event.competitions?.[0]?.competitors || [];
    const home = competitors.find((team) => team.homeAway === 'home');
    const away = competitors.find((team) => team.homeAway === 'away');
    if (!home?.team?.displayName || !away?.team?.displayName) return [];
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return [];
    return [{
      completed: Boolean(event.status?.type?.completed),
      home: { name: home.team.displayName, shortName: home.team.shortDisplayName, abbreviation: home.team.abbreviation, score: homeScore },
      away: { name: away.team.displayName, shortName: away.team.shortDisplayName, abbreviation: away.team.abbreviation, score: awayScore },
    }];
  });
}

export async function POST(request: Request) {
  const expected = config.ROOMIES_CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`)
    return json({ error: 'Unauthorized.' }, 401);
  try {
    const row = await database()
      .prepare('SELECT data, revision FROM league_state WHERE id = ?')
      .bind('club')
      .first<{ data: string; revision: number }>();
    if (!row) return json({ error: 'League is not initialized.' }, 409);
    const league = JSON.parse(row.data) as League;
    const today = new Date().toISOString().slice(0, 10);
    const report: Array<{ date: string; graded: number; complete: boolean }> = [];
    for (const week of league.weeks) {
      if (week.date > today || week.picks.every((pick) => pick.result !== 'pending') || week.picks.some((pick) => !pick.text)) continue;
      const settled = settleAvailablePicks(week, await scoreboard(week.date));
      if (!settled.graded.length) continue;
      week.picks = settled.picks;
      if (settled.complete) week.locked = true;
      report.push({ date: week.date, graded: settled.graded.length, complete: settled.complete });
    }
    if (report.length) {
      const updated = await database()
        .prepare('UPDATE league_state SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
        .bind(JSON.stringify(league), 'club', row.revision)
        .run();
      if (!updated.meta.changes) return json({ error: 'League changed; run again.' }, 409);
    }
    return json({ ok: true, weeks: report, note: 'Payouts remain the commissioner-entered total because sportsbooks do not expose the parlay payout.' });
  } catch {
    return json({ error: 'Automatic scoring could not reach the scoreboard.' }, 503);
  }
}
