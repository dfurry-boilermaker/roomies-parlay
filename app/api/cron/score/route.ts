import { env } from 'cloudflare:workers';
import { database } from '@/db/store';
import { settleAvailablePicks, type FinalGame } from '@/lib/auto-score';
import type { League } from '@/lib/league';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status });
const config = env as unknown as { ROOMIES_CRON_SECRET?: string };

type EspnEvent = {
  id?: string;
  date?: string;
  status?: { type?: { completed?: boolean } };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: 'home' | 'away';
      score?: string;
      team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
    }>;
  }>;
};

async function scoreboard(date: string): Promise<{ games: FinalGame[]; latestStart: number | null }> {
  const query = `dates=${date.replaceAll('-', '')}&limit=1000&region=us&lang=en`;
  const urls = [
    `https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?${query}`,
    `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?${query}`,
  ];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Roomies-Parlay-Scorer/1.0',
        },
      });
      if (!response.ok) throw Error(`Scoreboard returned ${response.status}.`);
      const body = (await response.json()) as { events?: EspnEvent[] };
      const latestStart = Math.max(
        ...(body.events || [])
          .map((event) => (event.date ? Date.parse(event.date) : NaN))
          .filter(Number.isFinite),
        0,
      ) || null;
      const games: Array<FinalGame & { eventId?: string }> = (body.events || []).flatMap((event) => {
    const competitors = event.competitions?.[0]?.competitors || [];
    const home = competitors.find((team) => team.homeAway === 'home');
    const away = competitors.find((team) => team.homeAway === 'away');
    if (!home?.team?.displayName || !away?.team?.displayName) return [];
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return [];
        return [{
          eventId: event.id,
          completed: Boolean(event.status?.type?.completed),
          home: { name: home.team.displayName, shortName: home.team.shortDisplayName, abbreviation: home.team.abbreviation, score: homeScore },
          away: { name: away.team.displayName, shortName: away.team.shortDisplayName, abbreviation: away.team.abbreviation, score: awayScore },
        }];
      });
      const settledGames = await Promise.all(games.map(async ({ eventId, ...game }) => {
        if (!eventId || !game.completed) return game;
        try {
          const summary = await fetch(
            `https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${eventId}`,
            { headers: { Accept: 'application/json', 'User-Agent': 'Roomies-Parlay-Scorer/1.0' } },
          );
          if (!summary.ok) return game;
          const data = (await summary.json()) as { pickcenter?: Array<{ overUnder?: number }> };
          const closingTotal = data.pickcenter?.[0]?.overUnder;
          return typeof closingTotal === 'number' ? { ...game, closingTotal } : game;
        } catch { return game; }
      }));
      return { games: settledGames, latestStart };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : Error('Scoreboard provider is unavailable.');
}

export async function POST(request: Request) {
  const expected = config.ROOMIES_CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`)
    return json({ error: 'Unauthorized.' }, 401);
  let stage = 'reading league';
  try {
    const requestedDate = new URL(request.url).searchParams.get('date');
    if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))
      return json({ error: 'Date must use YYYY-MM-DD.' }, 400);
    const row = await database()
      .prepare('SELECT data, revision FROM league_state WHERE id = ?')
      .bind('club')
      .first<{ data: string; revision: number }>();
    if (!row) return json({ error: 'League is not initialized.' }, 409);
    const league = JSON.parse(row.data) as League;
    const today = new Date().toISOString().slice(0, 10);
    const report: Array<{ date: string; graded: number; complete: boolean }> = [];
    for (const week of league.weeks) {
      if (requestedDate && week.date !== requestedDate) continue;
      if (week.date > today || week.picks.every((pick) => pick.result !== 'pending') || week.picks.some((pick) => !pick.text)) continue;
      stage = `scoring ${week.date}`;
      const board = await scoreboard(week.date);
      const readyAfter = board.latestStart ? board.latestStart + 5 * 60 * 60 * 1000 : 0;
      if (readyAfter && Date.now() < readyAfter) continue;
      const settled = settleAvailablePicks(week, board.games);
      if (!settled.graded.length) continue;
      week.picks = settled.picks;
      if (settled.complete) week.locked = true;
      report.push({ date: week.date, graded: settled.graded.length, complete: settled.complete });
    }
    const now = new Date();
    const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7;
    const nextSaturday = new Date(now);
    nextSaturday.setUTCDate(now.getUTCDate() + daysUntilSaturday);
    const nextDate = nextSaturday.toISOString().slice(0, 10);
    let addedNextWeek = false;
    if (!league.weeks.some((week) => week.date === nextDate)) {
      league.weeks.push({
        date: nextDate,
        buyIn: 5,
        payout: 0,
        locked: false,
        picks: Array.from({ length: 5 }, () => ({ text: '', result: 'pending' })),
      });
      league.weeks.sort((a, b) => a.date.localeCompare(b.date));
      addedNextWeek = true;
    }
    if (report.length || addedNextWeek) {
      stage = 'saving league';
      const updated = await database()
        .prepare('UPDATE league_state SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
        .bind(JSON.stringify(league), 'club', row.revision)
        .run();
      if (!updated.meta.changes) return json({ error: 'League changed; run again.' }, 409);
    }
    return json({ ok: true, weeks: report, addedNextWeek, nextWeek: nextDate, note: 'Payouts remain the commissioner-entered total because sportsbooks do not expose the parlay payout.' });
  } catch (error) {
    return json({
      error: 'Automatic scoring could not complete.',
      stage,
      detail: error instanceof Error ? error.message : String(error),
    }, 503);
  }
}
