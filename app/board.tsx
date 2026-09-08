'use client';
import SignIn from './sign-in';
import PasswordSettings from './password-settings';
import { useEffect, useState } from 'react';
import {
  Flag,
  ArrowUpRight,
  Check,
  Plus,
  LockKeyhole,
  Trophy,
  Users,
  CalendarDays,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  names,
  money,
  balance,
  settlement,
  type League,
  type Week,
} from '@/lib/league';
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Board() {
  const [league, setLeague] = useState<League>({
    owner: '',
    emails: [],
    weeks: [],
  });
  const [identity, setIdentity] = useState({
    admin: false,
    index: -1,
    initialized: false,
    signedIn: false,
  });
  const [season, setSeason] = useState('2025');
  const [date, setDate] = useState('2025-11-29');
  const [tab, setTab] = useState('picks');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pick, setPick] = useState('');
  const [newDate, setNewDate] = useState('2026-09-12');
  async function refresh() {
    try {
      const r = await fetch('/api/league');
      const d = (await r.json()) as {
        error: string;
        identity: typeof identity;
        league?: League;
      };
      if (!r.ok) throw Error(d.error);
      if (d.league && d.identity.signedIn && !identity.signedIn) {
        const latest = d.league.weeks.at(-1);
        if (latest) {
          setSeason(latest.date.slice(0, 4));
          setDate(latest.date);
        }
      }
      setIdentity(d.identity);
      setLeague(d.league || { owner: '', emails: [], weeks: [] });
      setLoaded(true);
    } catch (e) {
      setMessage((e as Error).message);
      setLoaded(true);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const abort = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'view_league_week',
          description: 'Open an existing parlay week in the league board.',
          inputSchema: {
            type: 'object',
            properties: { date: { type: 'string' } },
            required: ['date'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute(input: unknown) {
            const value = (input as { date?: unknown })?.date;
            if (
              typeof value !== 'string' ||
              !league.weeks.some((w) => w.date === value)
            )
              throw Error('Unknown week');
            setSeason(value.slice(0, 4));
            setDate(value);
            setTab('picks');
            return { date: value, view: 'picks' };
          },
        },
        { signal: abort.signal },
      ),
    ).catch(() => {});
    return () => abort.abort();
  }, [league.weeks]);

  async function mutate(action: string, data: object = {}) {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const d = (await r.json()) as {
        error: string;
        identity: typeof identity;
        league?: League;
      };
      if (!r.ok) throw Error(d.error);
      await refresh();
      setMessage('Saved to the league.');
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const weeks = league.weeks.filter(
    (w) => season === 'All time' || w.date.startsWith(season),
  );
  const week = weeks.find((w) => w.date === date) || weeks.at(-1);
  const seasons = [...new Set(league.weeks.map((w) => w.date.slice(0, 4)))]
    .sort()
    .reverse();
  if (!loaded || !identity.signedIn)
    return <SignIn loading={!loaded} onSuccess={refresh} />;
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <img
            className="brandmark"
            src="/horsemen-icon.png"
            alt="Roomies Parlay"
          />
          ROOMIES<span className="brand-sub">PARLAY</span>
        </a>
        <span className="header-note">
          <span className="dot" /> COLLEGE FOOTBALL
        </span>
        <span className="club-count">
          <Users size={16} /> {names[identity.index]}{' '}
          <button
            className="text-button"
            onClick={async () => {
              const r = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'logout' }),
              });
              if (r.ok) {
                setLeague({ owner: '', emails: [], weeks: [] });
                setIdentity({
                  admin: false,
                  index: -1,
                  initialized: true,
                  signedIn: false,
                });
                setMessage('');
                setPick('');
                setTab('picks');
              }
            }}
          >
            Sign out
          </button>
        </span>
      </header>
      <main>
        <div className="page-title">
          <div>
            <p className="eyebrow">FIVE FRIENDS. ONE SATURDAY TRADITION.</p>
            <h1>
              Saturday’s on the line<span>.</span>
            </h1>
            <p className="muted">Your picks, your crew, your season.</p>
          </div>
          <Choice
            value={season}
            onChange={setSeason}
            options={[...seasons, 'All time']}
            label="Season"
          />
        </div>
        {message && (
          <p role="status" className="notice small">
            {message}
          </p>
        )}
        <div className="stats">
          <div>
            <span className="stat-label">PERFECT SATURDAYS</span>
            <strong>
              {
                weeks.filter((w) => w.picks.every((p) => p.result === 'win'))
                  .length
              }
              <small> / {weeks.length}</small>
            </strong>
            <span className="muted">All five picks hit</span>
          </div>
          <div>
            <span className="stat-label">WEEKLY BUY-IN</span>
            <strong>{money(week?.buyIn ?? 5)}</strong>
            <span className="muted">
              {money((week?.buyIn ?? 5) * 5)} split between losing picks
            </span>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList variant="line" className="navtabs">
            <TabsTrigger value="picks">Weekly picks</TabsTrigger>
            <TabsTrigger value="history">Season history</TabsTrigger>
            <TabsTrigger value="balances">Balances & rules</TabsTrigger>
            <TabsTrigger value="account">My password</TabsTrigger>
            {identity.admin && (
              <TabsTrigger value="manage">Manage league</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="picks">
            <div className="section-title">
              <div>
                <p className="eyebrow">THE WEEKLY TICKET</p>
                <h2>Five picks. All in.</h2>
              </div>
              <Choice
                value={week?.date || ''}
                onChange={setDate}
                options={weeks.map((w) => w.date).reverse()}
                label="Week"
              />
            </div>
            {week ? (
              <>
                <div className="ticket">
                  <div className="ticket-head">
                    <span>
                      <CalendarDays size={16} />{' '}
                      {new Date(week.date + 'T12:00:00').toLocaleDateString(
                        'en-US',
                        { month: 'long', day: 'numeric', year: 'numeric' },
                      )}
                    </span>
                    <span>
                      {week.locked ? (
                        <>
                          <LockKeyhole size={14} /> Picks locked
                        </>
                      ) : (
                        'Open for picks'
                      )}
                    </span>
                  </div>
                  <div className="pick-grid">
                    {week.picks.map((p, i) => (
                      <article key={names[i]} className="pick-card">
                        <div className="person">
                          <span className={'avatar a' + i}>{names[i][0]}</span>
                          <span>{names[i]}</span>
                          {identity.index === i && <small>YOU</small>}
                        </div>
                        <p className="pick-label">
                          {p.text ? 'PARLAY LEG' : 'WAITING FOR A PICK'}
                        </p>
                        <h3>{p.text || 'Your call.'}</h3>
                        <span className={'result ' + p.result}>
                          {p.result === 'win' ? <Check size={14} /> : null}
                          {p.result === 'pending'
                            ? 'Awaiting result'
                            : p.result === 'absent'
                              ? 'Did not play'
                              : p.result === 'push'
                                ? 'Push'
                                : p.result === 'win'
                                  ? 'Win'
                                  : 'Loss'}
                        </span>
                        {identity.index === i && !week.locked && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (
                                await mutate('pick', {
                                  date: week.date,
                                  text: pick,
                                })
                              )
                                setPick('');
                            }}
                          >
                            <label className="sr-only" htmlFor="my-pick">
                              Your pick
                            </label>
                            <input
                              id="my-pick"
                              required
                              maxLength={100}
                              value={pick}
                              onChange={(e) => setPick(e.target.value)}
                              placeholder={p.text || 'e.g. Michigan -3.5'}
                            />
                            <button disabled={busy} type="submit">
                              Save pick
                            </button>
                          </form>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className="ticket-bottom">
                    <span>
                      {week.picks.filter((p) => p.text).length} of 5 picks
                      submitted
                    </span>
                    <b>
                      {settlement(week).complete
                        ? `${settlement(week).losers} losing picks · ${money(settlement(week).charge)} per loser`
                        : 'Settlement pending all five results'}
                    </b>
                  </div>
                </div>
                <div className="lower-grid">
                  <div className="payout-card">
                    <span className="eyebrow">THIS WEEK’S PAYOUT</span>
                    <strong>
                      {money(week.payout)}
                      <small> / person</small>
                    </strong>
                    <p>
                      {week.picks.every((p) => p.result === 'win')
                        ? 'A clean sweep. Every horse came home.'
                        : 'Payouts are recorded by Daniel after the games.'}
                    </p>
                    <Trophy className="trophy" size={58} />
                  </div>
                  <div className="rule-card">
                    <span className="eyebrow">THE HOUSE RULE</span>
                    <h3>Misses split the buy-in.</h3>
                    <p>
                      At $5 each, the weekly total is $25. Two losing picks?
                      Those two pay $12.50 each. A winning parlay’s total payout
                      is split five ways.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setTab('balances')}
                    >
                      See the breakdown <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p>No weeks yet. Daniel can add the first Saturday.</p>
            )}
          </TabsContent>
          <TabsContent value="history">
            <div className="section-title">
              <div>
                <p className="eyebrow">EVERY SATURDAY, ON RECORD</p>
                <h2>The season ledger</h2>
              </div>
              <span className="muted">
                Green = win · Red = loss · Gray = push
              </span>
            </div>
            <div className="table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Saturday</TableHead>
                    {names.map((n) => (
                      <TableHead key={n}>{n}</TableHead>
                    ))}
                    <TableHead>Payout / person</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((w) => (
                    <TableRow key={w.date}>
                      <TableCell>
                        <button
                          className="date-button"
                          onClick={() => {
                            setDate(w.date);
                            setTab('picks');
                          }}
                        >
                          {w.date.slice(5)}
                        </button>
                      </TableCell>
                      {w.picks.map((p, i) => (
                        <TableCell key={i}>
                          <span className={'history-pick ' + p.result}>
                            {p.text || '—'}
                            <small>{p.result}</small>
                          </span>
                        </TableCell>
                      ))}
                      <TableCell>
                        <b>{money(w.payout)}</b>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="footnote">
              Imported directly from your workbook, including hidden 2022–2024
              tabs, NFL entries and the four-person week. Pushes and absences
              are preserved; the green 2023 “push/win” entry retains the sheet’s
              win classification.
            </p>
          </TabsContent>
          <TabsContent value="balances">
            <div className="section-title">
              <div>
                <p className="eyebrow">THE SEASON TALLY</p>
                <h2>Where everyone stands</h2>
              </div>
            </div>
            <div className="balance-grid">
              {names.map((n, i) => (
                <article className="balance-card" key={n}>
                  <span className={'avatar a' + i}>{n[0]}</span>
                  <h3>{n}</h3>
                  <strong>{money(balance(weeks, i))}</strong>
                  <p>
                    {weeks.filter((w) => w.picks[i].result === 'win').length}{' '}
                    wins ·{' '}
                    {weeks.filter((w) => w.picks[i].result === 'loss').length}{' '}
                    losses
                  </p>
                  <small>Payouts less losing-week charges</small>
                </article>
              ))}
            </div>
            <div className="rules">
              <h3>How the math works</h3>
              <p>
                Weekly charge per loser = (buy-in × participating members) ÷
                number of losing picks. A win, push or absence pays no
                losing-week charge. If no picks lose, the charge is $0. The
                total parlay payout is divided equally five ways. Imported
                payout amounts are already the per-person share.
              </p>
              <p>
                Only fully settled weeks count. Absent members reduce that
                week’s stake and are not counted as wins or losses. Charges
                retain full precision across the season and balances round to
                cents at display, matching your season sheets. All-time balances
                include 2022, which the workbook’s summary omits because it
                references an empty row. These balances track earnings, not
                whether payments have been sent.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="account">
            <PasswordSettings onSignedOut={refresh} />
          </TabsContent>
          <TabsContent value="manage">
            {identity.admin && (
              <>
                <div className="section-title">
                  <h2>Commissioner’s desk</h2>
                </div>
                <div className="manage-grid">
                  <form
                    className="rules"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await mutate('addWeek', { date: newDate })) {
                        setSeason(newDate.slice(0, 4));
                        setDate(newDate);
                        setTab('picks');
                      }
                    }}
                  >
                    <h3>Add a Saturday</h3>
                    <label>
                      Week date
                      <input
                        type="date"
                        required
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                      />
                    </label>
                    <button disabled={busy}>
                      <Plus size={16} /> Add week
                    </button>
                  </form>
                  <PasswordSettings admin onSignedOut={refresh} />
                </div>
                {week && (
                  <form
                    className="rules"
                    key={week.date}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      mutate('settle', {
                        date: week.date,
                        buyIn: Number(f.get('buyIn')),
                        payout: Number(f.get('payout')) / 5,
                        picks: week.picks.map((p, i) => ({
                          text: String(f.get('text' + i)),
                          result: String(f.get('result' + i)),
                        })),
                      });
                    }}
                  >
                    <h3>Manage {week.date}</h3>
                    <p>Select a week in Weekly picks to manage it here.</p>
                    <div className="admin-picks">
                      {week.picks.map((p, i) => (
                        <div key={i}>
                          <label>
                            {names[i]}
                            <input
                              name={'text' + i}
                              defaultValue={p.text}
                              maxLength={100}
                            />
                          </label>
                          <ResultChoice
                            name={'result' + i}
                            initial={p.result}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="form-row">
                      <label>
                        Buy-in per person ($)
                        <input
                          name="buyIn"
                          type="number"
                          min="0"
                          max="10000"
                          step="0.01"
                          defaultValue={week.buyIn}
                        />
                      </label>
                      <label>
                        Total parlay payout ($)
                        <input
                          name="payout"
                          type="number"
                          min="0"
                          max="1000000"
                          step="0.01"
                          defaultValue={Math.round(week.payout * 500) / 100}
                        />
                      </label>
                    </div>
                    <button disabled={busy}>Save results & amounts</button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        mutate('lock', {
                          date: week.date,
                          locked: !week.locked,
                        })
                      }
                    >
                      {week.locked ? 'Reopen picks' : 'Lock picks'}
                    </button>
                  </form>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
        <footer>
          <span>
            <Flag size={14} /> ROOMIES PARLAY
          </span>
          <span>One pick each. Every week.</span>
        </footer>
      </main>
    </>
  );
}
function ResultChoice({ name, initial }: { name: string; initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <input type="hidden" name={name} value={v} />
      <Choice
        label="Pick result"
        value={v}
        onChange={setV}
        options={['pending', 'win', 'loss', 'push', 'absent']}
      />
    </>
  );
}
