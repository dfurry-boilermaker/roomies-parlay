'use client';
import { useState } from 'react';
import { names } from '@/lib/league';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
export default function PasswordSettings({
  admin = false,
  onSignedOut,
}: {
  admin?: boolean;
  onSignedOut: () => Promise<void>;
}) {
  const [member, setMember] = useState('Erik');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="rules password-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        setMessage('');
        try {
          if (f.get('password') !== f.get('confirm'))
            throw Error('The new passwords do not match.');
          const r = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: admin ? 'resetPassword' : 'changePassword',
              member: names.indexOf(member),
              password: f.get('password'),
              currentPassword: f.get('currentPassword'),
            }),
          });
          const d = (await r.json()) as { error?: string };
          if (!r.ok) throw Error(d.error);
          form.reset();
          if (admin)
            setMessage(
              `${member}’s password has been reset. Share it with them privately.`,
            );
          else await onSignedOut();
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{admin ? 'Reset a member’s password' : 'Change your password'}</h3>
      <p>
        {admin
          ? 'Set a new password if a friend needs help signing in.'
          : 'Choose a 4-digit PIN or a password of at least 10 characters. You’ll sign in again after saving.'}
      </p>
      {admin ? (
        <>
          <label id="reset-member-label">Member</label>
          <Select value={member} onValueChange={(v) => v && setMember(v)}>
            <SelectTrigger aria-labelledby="reset-member-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {names.slice(1).map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <label>
          Current password
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
      )}
      <label>
        New PIN or password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={4}
          maxLength={128}
          required
        />
      </label>
      <label>
        Confirm new PIN or password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={4}
          maxLength={128}
          required
        />
      </label>
      <button disabled={busy}>
        {busy ? 'Saving…' : admin ? 'Reset password' : 'Save password'}
      </button>
      {message && (
        <p role="status" className="login-error">
          {message}
        </p>
      )}
    </form>
  );
}
