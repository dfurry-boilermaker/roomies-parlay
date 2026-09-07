export const names = ['Daniel', 'Erik', 'Johnny', 'Michael', 'Drew'];
export type Result = 'pending' | 'win' | 'loss' | 'push' | 'absent';
export type Pick = { text: string; result: Result };
export type Week = {
  date: string;
  buyIn: number;
  payout: number;
  locked: boolean;
  picks: Pick[];
};
export type League = { owner: string; emails: string[]; weeks: Week[] };
export function settlement(w: Week) {
  const complete = w.picks.every((p) => p.text && p.result !== 'pending');
  const losers = w.picks.filter((p) => p.result === 'loss').length;
  return {
    complete,
    losers,
    charge:
      complete && losers
        ? (w.buyIn * w.picks.filter((p) => p.result !== 'absent').length) /
          losers
        : 0,
  };
}
export function balance(weeks: Week[], i: number) {
  return weeks.reduce((v, w) => {
    const s = settlement(w);
    return (
      v +
      (s.complete
        ? w.payout - (w.picks[i].result === 'loss' ? s.charge : 0)
        : 0)
    );
  }, 0);
}
export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n,
  );
