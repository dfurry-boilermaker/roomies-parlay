import type { Pick, Result, Week } from './league';

type TeamScore = { name: string; shortName?: string; abbreviation?: string; score: number };
export type FinalGame = { home: TeamScore; away: TeamScore; completed: boolean };

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

function resultForComparison(value: number): Result {
  return value > 0 ? 'win' : value < 0 ? 'loss' : 'push';
}

/** Grades the common Roomies entry styles: "Team -3.5" and "Team A/Team B U47.5". */
export function gradePick(text: string, games: FinalGame[]): Result | null {
  const total = text.trim().match(/^(.+?)\s*\/\s*(.+?)\s+((?:o|over|u|under))\s*([0-9]+(?:\.[0-9]+)?)$/i);
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

  const spread = text.trim().match(/^(.+?)\s+([+-][0-9]+(?:\.[0-9]+)?)$/);
  if (!spread) return null;
  const [, pickedTeam, lineText] = spread;
  const matches = games.filter(
    (g) => g.completed && (teamMatches(pickedTeam, g.home) || teamMatches(pickedTeam, g.away)),
  );
  if (matches.length !== 1) return null;
  const game = matches[0];
  const isHome = teamMatches(pickedTeam, game.home);
  const pickedScore = isHome ? game.home.score : game.away.score;
  const opponentScore = isHome ? game.away.score : game.home.score;
  return resultForComparison(pickedScore + Number(lineText) - opponentScore);
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
