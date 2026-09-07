// Local-only test accounts. Never use these PINs on the deployed Site.
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const pepper = randomBytes(32).toString('hex');
const members = Array.from({ length: 5 }, (_, i) => {
  const salt = randomBytes(32).toString('hex');
  const password = String(i + 1).repeat(4);
  return {
    salt,
    hash: pbkdf2Sync(
      password + '\0' + pepper,
      salt,
      100000,
      32,
      'sha256',
    ).toString('hex'),
  };
});
writeFileSync(
  '.dev.vars',
  `AUTH_PEPPER="${pepper}"\nINITIAL_MEMBERS='${JSON.stringify(members)}'\n`,
  { mode: 0o600 },
);
console.log('Local test-only authentication configured.');
