import {
  bootstrap,
  session,
  sessionCookie,
  createSession,
  logout,
  limited,
  verifiedMember,
  setPassword,
} from '@/db/auth';
import { digest } from '@/lib/password';
export const dynamic = 'force-dynamic';
function json(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
}
export async function POST(req: Request) {
  try {
    if (
      req.headers.get('origin') &&
      req.headers.get('origin') !== new URL(req.url).origin
    )
      return json({ error: 'Request origin is not allowed.' }, 403);
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'Expected JSON.' }, 415);
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: 'Request too large.' }, 413);
    const b = JSON.parse(raw);
    if (b.action === 'logout') {
      await logout(req);
      return json({ ok: true }, 200, sessionCookie(req, '', 0));
    }
    await bootstrap();
    if (b.action === 'login') {
      if (
        !Number.isInteger(b.member) ||
        b.member < 0 ||
        b.member > 4 ||
        typeof b.password !== 'string' ||
        b.password.length > 128
      )
        return json(
          { error: 'Choose your name and enter your password.' },
          400,
        );
      const ip = req.headers.get('cf-connecting-ip') || 'local';
      if (
        (await limited('ip:' + (await digest(ip)), 30)) ||
        (await limited('member:' + b.member, 5))
      )
        return json(
          { error: 'Too many attempts. Please try again in 15 minutes.' },
          429,
        );
      const u = await verifiedMember(b.member, b.password);
      if (!u)
        return json(
          {
            error:
              'That password does not match. Try again or ask Daniel for help.',
          },
          401,
        );
      return json(
        { ok: true },
        200,
        sessionCookie(req, await createSession(u.id, u.version)),
      );
    }
    const u = await session(req);
    if (!u) return json({ error: 'Sign in first.' }, 401);
    if (await limited('password-change:' + u.id, 10))
      return json(
        { error: 'Too many password changes. Try again in 15 minutes.' },
        429,
      );
    if (
      typeof b.password !== 'string' ||
      (!/^\d{4}$/.test(b.password) && b.password.length < 10) ||
      b.password.length > 128
    )
      return json(
        {
          error:
            'Use exactly four digits, or a password from 10 to 128 characters.',
        },
        400,
      );
    if (b.action === 'changePassword') {
      if (
        typeof b.currentPassword !== 'string' ||
        b.currentPassword.length > 128 ||
        !(await verifiedMember(u.id, b.currentPassword))
      )
        return json({ error: 'Your current password is incorrect.' }, 401);
      await setPassword(u.id, b.password);
      return json(
        { ok: true, signedOut: true },
        200,
        sessionCookie(req, '', 0),
      );
    }
    if (b.action === 'resetPassword') {
      if (u.id !== 0)
        return json(
          { error: 'Only Daniel can reset another member’s password.' },
          403,
        );
      if (!Number.isInteger(b.member) || b.member < 1 || b.member > 4)
        return json({ error: 'Choose a friend to reset.' }, 400);
      await setPassword(b.member, b.password);
      return json({ ok: true });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch {
    return json(
      { error: 'Sign-in is temporarily unavailable. Please try again.' },
      503,
    );
  }
}
