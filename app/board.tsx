'use client';
import SignIn from './sign-in';
import PasswordSettings from './password-settings';
import { useEffect, useRef, useState } from 'react';
import {
  Flag,
  ArrowUpRight,
  Check,
  Download,
  Plus,
  LockKeyhole,
  Share2,
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

function ShareCard({
  week,
  onClose,
}: {
  week: Week;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 1080;
    const height = 1350;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(scale, scale);
    context.fillStyle = '#123f35';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#e39938';
    context.beginPath();
    context.arc(920, 120, 180, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d4e7d2';
    context.beginPath();
    context.arc(80, 1270, 240, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f7faf8';
    context.roundRect(56, 56, 968, 1238, 30);
    context.fill();
    context.fillStyle = '#123f35';
    context.font = '800 60px Arial, sans-serif';
    context.fillText('ROOMIES PARLAY', 104, 150);
    context.fillStyle = '#6c7c75';
    context.font = '700 25px Arial, sans-serif';
    context.fillText('SATURDAY CARD', 108, 198);
    context.fillStyle = '#e39938';
    context.fillRect(108, 230, 130, 8);
    const date = new Date(week.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    context.fillStyle = '#123f35';
    context.font = '700 34px Arial, sans-serif';
    context.fillText(date, 108, 300);
    context.fillStyle = '#6c7c75';
    context.font = '500 24px Arial, sans-serif';
    context.fillText('Five legs. One parlay.', 108, 340);
    const colors = ['#265846', '#68558c', '#9a7235', '#4b7090', '#9a614f'];
    week.picks.forEach((pick, index) => {
      const y = 390 + index * 155;
      context.fillStyle = '#edf3ef';
      context.roundRect(96, y, 888, 116, 18);
      context.fill();
      context.fillStyle = colors[index];
      context.beginPath();
      context.arc(150, y + 58, 29, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = '700 25px Arial, sans-serif';
      context.textAlign = 'center';
      context.fillText(names[index][0], 150, y + 67);
      context.textAlign = 'left';
      context.fillStyle = '#123f35';
      context.font = '700 25px Arial, sans-serif';
      context.fillText(names[index], 204, y + 45);
      context.fillStyle = pick.text ? '#315a46' : '#8a9891';
      context.font = '500 28px Arial, sans-serif';
      context.fillText(pick.text || 'Awaiting pick', 204, y + 82);
    });
    context.fillStyle = '#123f35';
    context.font = '700 24px Arial, sans-serif';
    context.fillText('roomies-parlay.danielfurry.chatgpt.site', 108, 1260);
  }, [week]);

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `roomies-parlay-${week.date}.png`, {
        type: 'image/png',
      });
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({ title: 'Roomies Parlay picks', files: [file] });
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  }

  return (
    <section className="share-card-panel" aria-label="Share picks card">
      <div className="share-card-copy">
        <div>
          <span className="eyebrow">READY FOR THE GROUP CHAT?</span>
          <h2>Share this week’s card</h2>
          <p>Export the picks as an image and drop it into iMessage.</p>
        </div>
        <button className="text-button" onClick={onClose} aria-label="Close share card">
          Close
        </button>
      </div>
      <canvas ref={canvasRef} className="share-card-canvas" />
      <div className="share-card-actions">
        <button onClick={share} type="button">
          <Share2 size={16} /> Share image
        </button>
        <button className="secondary-button" onClick={share} type="button">
          <Download size={16} /> Save image
        </button>
      </div>
    </section>
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
  const [tab, setTab] = useState('picks');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pick, setPick] = useState('');
  const [shareCardOpen, setShareCardOpen] = useState(false);
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
          description: 'Open an existing parlay week in season history.',
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
            setSeason(value.slice(0, 4));
            setTab('history');
            return { date: value, view: 'history' };
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
  const week = league.weeks.at(-1);
  const seasons = [...new Set(league.weeks.map((w) => w.date.slice(0, 4)))]
    .sort()
    .reverse();
  const standings = names
    .map((name, index) => ({ name, total: balance(weeks, index) }))
    .sort((a, b) => b.total - a.total);
  const leader = standings[0];
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
          Roomies Parlay
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
            <h1>
              Saturday’s on the line<span>.</span>
            </h1>
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
        {(() => {
          const settledWeeks = weeks.filter((w) => settlement(w).complete);
          return (
        <div className="stats">
          <div>
            <span className="stat-label">PERFECT SATURDAYS</span>
            <strong>
              {
                settledWeeks.filter((w) =>
                  w.picks.every((p) => p.result === 'win'),
                ).length
              }
              <small> / {settledWeeks.length}</small>
            </strong>
            <span className="muted">All five picks hit</span>
          </div>
          <div>
            <span className="stat-label">SEASON LEADER</span>
            <strong>{leader?.name || '—'}</strong>
            <span className="muted">
              {leader ? `${money(leader.total)} total P/L` : 'No settled weeks'}
            </span>
          </div>
        </div>
          );
        })()}
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
                      <article
                        key={names[i]}
                        className={
                          'pick-card ' +
                          (identity.index === i ? 'my-pick-card' : 'other-pick-card')
                        }
                      >
                        <div className="person">
                          <span className={'avatar a' + i}>{names[i][0]}</span>
                          <span>{names[i]}</span>
                          {identity.index === i && <small>YOU</small>}
                        </div>
                        <p className="pick-label">
                          {p.text ? 'PARLAY LEG' : 'WAITING FOR A PICK'}
                        </p>
                        <h3>{p.text || ''}</h3>
                        <span className={'result ' + p.result}>
                          {p.result === 'win' ? <Check size={14} /> : null}
                          {p.result === 'pending'
                            ? p.text
                              ? 'Awaiting result'
                              : 'Awaiting pick'
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
                              ) {
                                setPick('');
                                setShareCardOpen(true);
                              }
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
                    {week.picks.some((p) => p.text) && (
                      <button
                        className="share-trigger"
                        onClick={() => setShareCardOpen(true)}
                        type="button"
                      >
                        <Share2 size={14} /> Share card
                      </button>
                    )}
                    <b>
                      {settlement(week).complete
                        ? `${settlement(week).losers} losing picks · ${money(settlement(week).charge)} per loser`
                        : 'Settlement pending all five results'}
                    </b>
                  </div>
                </div>
                {shareCardOpen && (
                  <ShareCard week={week} onClose={() => setShareCardOpen(false)} />
                )}
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
                        : 'GitHub Actions grades final scores on Sunday and rechecks Monday; losing-week charges update automatically.'}
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
            <div className="history-desktop table-wrap">
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
                        {season === 'All time'
                          ? new Date(w.date + 'T12:00:00').toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric', year: 'numeric' },
                            )
                          : w.date.slice(5)}
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
                        {w.picks.every((p) => p.result === 'win') && (
                          <b>{money(w.payout)}</b>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="history-mobile">
              {weeks.map((w) => (
                <article className="history-week" key={w.date}>
                  <div className="history-week-head">
                    <span className="history-date">
                      {new Date(w.date + 'T12:00:00').toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )}
                    </span>
                    {w.picks.every((p) => p.result === 'win') && (
                      <strong>{money(w.payout)} <small>/ person</small></strong>
                    )}
                  </div>
                  <div className="history-week-picks">
                    {w.picks.map((p, i) => (
                      <div className="history-mobile-pick" key={names[i]}>
                        <span className={'avatar a' + i}>{names[i][0]}</span>
                        <span className="history-mobile-copy">
                          <b>{names[i]}</b>
                          <span>{p.text || 'No pick entered'}</span>
                        </span>
                        <span className={'result ' + p.result}>
                          {p.result === 'pending'
                            ? p.text
                              ? 'Awaiting result'
                              : 'Awaiting pick'
                            : p.result}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
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
