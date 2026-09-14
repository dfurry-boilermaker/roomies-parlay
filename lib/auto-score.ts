import type { Pick, Result, Week } from './league';

type TeamScore = { name: string; shortName?: string; abbreviation?: string; score: number };
export type FinalGame = {
  home: TeamScore;
  away: TeamScore;
  completed: boolean;
  closingTotal?: number;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/virgina/g, 'virginia')
    .replace(/[^a-z0-9]/g, '');

const aliases: Record<string, string> = {
  bc: 'bostoncollege',
  cincy: 'cincinnati',
  uc: 'cincinnati',
  wyo: 'wyoming',
};

const teamMatches = (candidate: string, team: TeamScore) => {
  const wanted = aliases[normalize(candidate)] || normalize(candidate);
  return [team.name, team.shortName, team.abbreviation]
    .filter(Boolean)
    .map((value) => normalize(value!))
    .some((value) => value === wanted || value.includes(wanted) || wanted.includes(value));
};

const teamMatchStrength = (candidate: string, team: TeamScore) => {
  const wanted = aliases[normalize(candidate)] || normalize(candidate);
  const values = [team.name, team.shortName, team.abbreviation]
    .filter(Boolean)
    .map((value) => normalize(value!));
  if (values.some((value) => value === wanted)) return 2;
  if (values.some((value) => value.includes(wanted) || wanted.includes(value))) return 1;
  return 0;
};

const bestTeamGames = (candidate: string, games: FinalGame[]) => {
  const matches = games
    .filter((g) => g.completed)
    .map((game) => ({
      game,
      strength: Math.max(
        teamMatchStrength(candidate, game.home),
        teamMatchStrength(candidate, game.away),
      ),
    }))
    .filter(({ strength }) => strength > 0);
  const best = Math.max(...matches.map(({ strength }) => strength), 0);
  return matches.filter(({ strength }) => strength === best).map(({ game }) => game);
};

function resultForComparison(value: number): Result {
  return value > 0 ? 'win' : value < 0 ? 'loss' : 'push';
}

/** Grades spreads, totals, and straight-up entries such as "Team", "Team ML", or "Team Money Line". */
export function gradePick(text: string, games: FinalGame[]): Result | null {
  // Members sometimes add a note after the market (for example, "or spread
  // if moves"). It is guidance for the person placing the bet, not part of
  // the market that needs to be graded.
  const cleaned = text.trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
  const total = cleaned.match(/^(.+?)\s*\/\s*(.+?)\s+((?:o|over|u|under))\s*([0-9]+(?:\.[0-9]+)?)$/i);
  if (total) {
    const [, first, second, direction, lineText] = total;
    const game = games.find(
      (g) =>
        g.completed &&
        ((teamMatches(first, g.home) && teamMatches(second, g.away)) ||
          (teamMatches(first, g.away) && teamMatches(second, g.home))),
    );
    if (!game) return null;
    const difference = game.home.score + game.away.score - Number(lineText);
    return resultForComparison(/^o|over$/i.test(direction) ? difference : -difference);
  }

  const shorthandTotal = cleaned.match(/^(.+?)\s+(.+?)\s+(over|under)$/i);
  if (shorthandTotal) {
    const [, first, second, direction] = shorthandTotal;
    const game = games.find(
      (g) =>
        g.completed &&
        ((teamMatches(first, g.home) && teamMatches(second, g.away)) ||
          (teamMatches(first, g.away) && teamMatches(second, g.home))),
    );
    if (!game || game.closingTotal === undefined) return null;
    const difference = game.home.score + game.away.score - game.closingTotal;
    return resultForComparison(/^over$/i.test(direction) ? difference : -difference);
  }

  const spread = cleaned.match(/^(.+?)\s+([+-][0-9]+(?:\.[0-9]+)?)$/);
  if (spread) {
    const [, pickedTeam, lineText] = spread;
    const matches = bestTeamGames(pickedTeam, games);
    if (matches.length !== 1) return null;
    const game = matches[0];
    const isHome = teamMatches(pickedTeam, game.home);
    const pickedScore = isHome ? game.home.score : game.away.score;
    const opponentScore = isHome ? game.away.score : game.home.score;
    return resultForComparison(pickedScore + Number(lineText) - opponentScore);
  }

  const straightUp = cleaned.match(/^(.+?)(?:\s+(?:ml|money\s+line))?$/i);
  if (!straightUp) return null;
  const [, pickedTeam] = straightUp;
  const matches = bestTeamGames(pickedTeam, games);
  if (matches.length !== 1) return null;
  const game = matches[0];
  const isHome = teamMatches(pickedTeam, game.home);
  const pickedScore = isHome ? game.home.score : game.away.score;
  const opponentScore = isHome ? game.away.score : game.home.score;
  return resultForComparison(pickedScore - opponentScore);
}

export function settleAvailablePicks(week: Week, games: FinalGame[]) {
  const picks = week.picks.map((pick) => ({ ...pick }));
  const graded: Array<{ index: number; result: Result }> = [];
  picks.forEach((pick, index) => {
    if (!pick.text || pick.result !== 'pending') return;
    const result = gradePick(pick.text, games);
    if (result) {
      picks[index] = { ...pick, result };
      graded.push({ index, result });
    }
  });
  return {
    picks,
    graded,
    complete: picks.every((pick) => pick.text && pick.result !== 'pending'),
  };
}
