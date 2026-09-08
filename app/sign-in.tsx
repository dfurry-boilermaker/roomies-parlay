'use client';
import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { names } from '@/lib/league';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
export default function SignIn({
  loading,
  onSuccess,
}: {
  loading: boolean;
  onSuccess: () => Promise<void>;
}) {
  const [member, setMember] = useState('Daniel');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          member: names.indexOf(member),
          password,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(d.error || 'Unable to sign in.');
      setPassword('');
      await onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <a className="brand" href="/">
        <img
          className="brandmark"
          src="/horsemen-icon.png"
          alt="Horsemen Pick Club"
        />
        HORSEMEN<span className="brand-sub">PICK CLUB</span>
      </a>
      <div className="login-card">
        <div className="login-badge">
          <LockKeyhole size={22} />
        </div>
        <p className="eyebrow">THE CREW’S ALL HERE</p>
        <h1>
          Welcome back<span>.</span>
        </h1>
        <p className="muted">Pick your name. Let’s get to Saturday.</p>
        <form onSubmit={submit}>
          <label id="member-label">Your name</label>
          <Select value={member} onValueChange={(v) => v && setMember(v)}>
            <SelectTrigger aria-labelledby="member-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {names.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" autoComplete="username" value={member} />
          <label htmlFor="password">Your PIN or password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your 4-digit PIN"
          />
          <button disabled={loading || busy} type="submit">
            {loading ? 'Loading…' : busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={17} />
          </button>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <p className="login-help">Forgot your PIN? Ask Daniel to reset it.</p>
      </div>
      <p className="login-footer">Five friends. One parlay. Every Saturday.</p>
    </div>
  );
}
