import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw Error('League database is unavailable.');
  return env.DB;
}
