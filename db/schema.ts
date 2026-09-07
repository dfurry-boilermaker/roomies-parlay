import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const leagueState = sqliteTable('league_state', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});
export const members = sqliteTable('members', {
  id: integer('id').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  version: integer('version').notNull().default(0),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  memberId: integer('member_id').notNull(),
  version: integer('version').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const loginLimits = sqliteTable('login_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  resetsAt: integer('resets_at').notNull(),
});
