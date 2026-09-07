import { env } from 'cloudflare:workers';
import { database } from './store';
import { digest, passwordHash, randomToken, equal } from '@/lib/password';
import history from '@/lib/history.json';
export { passwordHash, randomToken, equal };
const COOKIE = 'horsemen_session';
const AGE = 60 * 60 * 24 * 30;
export function pepper() {
  const p = (env as unknown as { AUTH_PEPPER?: string }).AUTH_PEPPER;
  if (!p) throw Error('Authentication is not configured.');
  return p;
}
export async function bootstrap() {
  const found = await database()
    .prepare('SELECT id FROM members LIMIT 1')
    .first();
  if (found) return;
  const raw = (env as unknown as { INITIAL_MEMBERS?: string }).INITIAL_MEMBERS;
  if (!raw) throw Error('Member passwords have not been configured.');
  const members = JSON.parse(raw) as { salt: string; hash: string }[];
  if (members.length !== 5) throw Error('Invalid member configuration.');
  const saturday=new Date();saturday.setUTCDate(saturday.getUTCDate()+(6-saturday.getUTCDay()+7)%7);
  const openingDate=saturday.toISOString().slice(0,10);
  const initialWeeks=[...history,{date:openingDate,buyIn:5,payout:0,locked:false,picks:Array.from({length:5},()=>({text:'',result:'pending'}))}];
  await database().batch([
    ...members.map((m, i) =>
      database()
        .prepare(
          'INSERT OR IGNORE INTO members (id,password_hash,salt,version) VALUES (?,?,?,0)',
        )
        .bind(i, m.hash, m.salt),
    ),
    database()
      .prepare(
        'INSERT OR IGNORE INTO league_state (id,data,revision) VALUES (?,?,0)',
      )
      .bind(
        'club',
        JSON.stringify({ owner: 'member:0', emails: [], weeks: initialWeeks }),
      ),
  ]);
}
export function cookieToken(req: Request) {
  return (
    req.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + '='))
      ?.slice(COOKIE.length + 1) || ''
  );
}
export async function session(req: Request) {
  const token = cookieToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return database()
    .prepare(
      'SELECT m.id, m.version FROM sessions s JOIN members m ON m.id = s.member_id AND m.version = s.version WHERE s.token_hash = ? AND s.expires_at > ?',
    )
    .bind(await digest(token), Date.now())
    .first<{ id: number; version: number }>();
}
export function sessionCookie(req: Request, token: string, age = AGE) {
  const secure = new URL(req.url).protocol === 'https:';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
export async function createSession(id: number, version: number) {
  const token = randomToken();
  await database().batch([
    database()
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .bind(Date.now()),
    database()
      .prepare(
        'INSERT INTO sessions (token_hash,member_id,version,expires_at) VALUES (?,?,?,?)',
      )
      .bind(await digest(token), id, version, Date.now() + AGE * 1000),
  ]);
  return token;
}
export async function logout(req: Request) {
  const token = cookieToken(req);
  if (token)
    await database()
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await digest(token))
      .run();
}
export async function limited(key: string, max: number) {
  const now = Date.now();
  const row = await database()
    .prepare(
      `INSERT INTO login_limits (key,attempts,resets_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN resets_at <= ? THEN 1 ELSE attempts + 1 END, resets_at = CASE WHEN resets_at <= ? THEN ? ELSE resets_at END RETURNING attempts`,
    )
    .bind(key, now + 900000, now, now, now + 900000)
    .first<{ attempts: number }>();
  return !row || row.attempts > max;
}
export async function verifiedMember(id: number, password: string) {
  const member = await database()
    .prepare('SELECT id,password_hash,salt,version FROM members WHERE id = ?')
    .bind(id)
    .first<{
      id: number;
      password_hash: string;
      salt: string;
      version: number;
    }>();
  if (!member) return null;
  return equal(
    await passwordHash(password, member.salt, pepper()),
    member.password_hash,
  )
    ? member
    : null;
}
export async function setPassword(id: number, password: string) {
  const salt = randomToken();
  const hash = await passwordHash(password, salt, pepper());
  await database().batch([
    database()
      .prepare(
        'UPDATE members SET password_hash = ?, salt = ?, version = version + 1 WHERE id = ?',
      )
      .bind(hash, salt, id),
    database().prepare('DELETE FROM sessions WHERE member_id = ?').bind(id),
  ]);
}
