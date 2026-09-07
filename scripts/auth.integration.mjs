// Run only against a local test instance initialized with configure-test-auth.mjs.
import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
async function call(path, body, cookie = '', origin = base) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: await r.text().then((t) => {
      try {
        return JSON.parse(t);
      } catch {
        return { error: t };
      }
    }),
    cookie: r.headers.get('set-cookie')?.split(';')[0],
    header: r.headers.get('set-cookie'),
  };
}
let r = await call('/api/league');
assert.equal(r.data.league, undefined);
assert.equal(r.data.identity.signedIn, false);
r = await call('/api/league', { action: 'addWeek', date: '2099-10-10' });
assert.equal(r.status, 401);
r = await call('/api/auth', { action: 'login', member: 0, password: '1111' });
assert.equal(r.status, 200);
assert.match(r.header, /HttpOnly/);
assert.match(r.header, /SameSite=Strict/);
const daniel = r.cookie;
r = await call('/api/league', null, daniel);
assert.equal(r.data.identity.admin, true);
assert.equal(r.data.league.weeks.filter((w) => w.date < '2026').length, 56);
r = await call('/api/auth', { action: 'login', member: 1, password: '2222' });
assert.equal(r.status, 200);
const erik = r.cookie;
r = await call('/api/league', null, erik);
assert.equal(r.data.identity.index, 1);
assert.equal(r.data.identity.admin, false);
r = await call('/api/league', { action: 'addWeek', date: '2099-10-10' }, erik);
assert.equal(r.status, 403);
r = await call(
  '/api/league',
  { action: 'addWeek', date: '2099-10-10' },
  daniel,
);
assert.ok([200, 409].includes(r.status));
r = await call(
  '/api/league',
  { action: 'pick', date: '2099-10-10', text: 'Local test pick', member: 0 },
  erik,
);
assert.equal(r.status, 200);
r = await call('/api/league', null, daniel);
const w = r.data.league.weeks.find((w) => w.date === '2099-10-10');
assert.equal(w.picks[1].text, 'Local test pick');
assert.equal(w.picks[0].text, '');
r = await call(
  '/api/league',
  { action: 'lock', date: '2099-10-10', locked: true },
  daniel,
);
assert.equal(r.status, 200);
r = await call(
  '/api/league',
  { action: 'pick', date: '2099-10-10', text: 'Changed' },
  erik,
);
assert.equal(r.status, 409);
r = await call(
  '/api/league',
  { action: 'lock', date: '2099-10-10', locked: false },
  daniel,
  'https://unrelated.example',
);
assert.equal(r.status, 403);
r = await call(
  '/api/auth',
  { action: 'resetPassword', member: 0, password: '9999' },
  erik,
);
assert.equal(r.status, 403);
r = await call(
  '/api/auth',
  { action: 'changePassword', currentPassword: 'wrong', password: '9090' },
  erik,
);
assert.equal(r.status, 401);
r = await call(
  '/api/auth',
  { action: 'changePassword', currentPassword: '2222', password: '9090' },
  erik,
);
assert.equal(r.status, 200);
r = await call('/api/league', null, erik);
assert.equal(r.data.identity.signedIn, false);
r = await call('/api/auth', { action: 'login', member: 1, password: '2222' });
assert.equal(r.status, 401);
r = await call('/api/auth', { action: 'login', member: 1, password: '9090' });
assert.equal(r.status, 200);
const newErik = r.cookie;
r = await call(
  '/api/auth',
  { action: 'resetPassword', member: 1, password: '2222' },
  daniel,
);
assert.equal(r.status, 200);
r = await call('/api/league', null, newErik);
assert.equal(r.data.identity.signedIn, false);
for (let i = 0; i < 5; i++) {
  r = await call('/api/auth', {
    action: 'login',
    member: 4,
    password: 'wrong',
  });
  assert.equal(r.status, 401);
}
r = await call('/api/auth', { action: 'login', member: 4, password: '5555' });
assert.equal(r.status, 429);
r = await call('/api/auth', { action: 'logout' }, daniel);
assert.equal(r.status, 200);
r = await call('/api/league', null, daniel);
assert.equal(r.data.identity.signedIn, false);
console.log(
  'Verified private data, member login, own-pick enforcement, admin authorization, locking, origin rejection, password changes, session revocation, reset, throttling and logout.',
);
