import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.DATA_DIR || './data';
fs.mkdirSync(path.join(DIR, 'media'), { recursive: true });
fs.mkdirSync(path.join(DIR, 'renders'), { recursive: true });
export const MEDIA_DIR = path.join(DIR, 'media');
export const RENDER_DIR = path.join(DIR, 'renders');

export const db = new Database(path.join(DIR, 'ad-studio.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS orgs (id TEXT PRIMARY KEY, name TEXT, plan TEXT DEFAULT 'trial', created INTEGER);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, org_id TEXT REFERENCES orgs(id), email TEXT UNIQUE, name TEXT, pw TEXT, role TEXT DEFAULT 'owner', created INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, org_id TEXT, data TEXT, updated INTEGER, updated_by TEXT);
CREATE TABLE IF NOT EXISTS project_history (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT, user_id TEXT, at INTEGER, data TEXT);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, org_id TEXT, project_id TEXT, file TEXT, mime TEXT, size INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS integrations (org_id TEXT, platform TEXT, account TEXT, account_id TEXT, token TEXT, refresh TEXT, expires INTEGER, connected INTEGER, PRIMARY KEY (org_id, platform));
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, org_id TEXT, platform TEXT, verifier TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS renders (id TEXT PRIMARY KEY, org_id TEXT, status TEXT, format TEXT, file TEXT, error TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, org_id TEXT, project_id TEXT, ad_key TEXT, platform TEXT, status TEXT, remote_id TEXT, url TEXT, target_url TEXT, error TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS clicks (pub_id TEXT, at INTEGER, ref TEXT);
CREATE TABLE IF NOT EXISTS stats (pub_id TEXT PRIMARY KEY, views INTEGER, likes INTEGER, shares INTEGER, comments INTEGER, fetched INTEGER);
CREATE TABLE IF NOT EXISTS invites (token TEXT PRIMARY KEY, org_id TEXT, email TEXT, role TEXT, invited_by TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS usage (org_id TEXT, month TEXT, kind TEXT, n INTEGER, PRIMARY KEY (org_id, month, kind));
CREATE TABLE IF NOT EXISTS billing_events (id TEXT PRIMARY KEY, type TEXT, org_id TEXT, at INTEGER, data TEXT);
`);
// Spalten nachrüsten (idempotent)
for (const sql of [
  'ALTER TABLE users ADD COLUMN superadmin INTEGER DEFAULT 0',
  'ALTER TABLE orgs ADD COLUMN trial_ends INTEGER', 'ALTER TABLE orgs ADD COLUMN paid INTEGER DEFAULT 0', "ALTER TABLE orgs ADD COLUMN cycle TEXT DEFAULT 'monthly'",
  "ALTER TABLE orgs ADD COLUMN addons TEXT DEFAULT '{}'", 'ALTER TABLE orgs ADD COLUMN internal INTEGER DEFAULT 0', 'ALTER TABLE orgs ADD COLUMN stripe_customer TEXT', 'ALTER TABLE orgs ADD COLUMN stripe_sub TEXT',
]) { try { db.exec(sql); } catch (e) { /* existiert schon */ } }

export const id = () => crypto.randomBytes(9).toString('base64url');

const KEY = process.env.TOKEN_KEY ? Buffer.from(process.env.TOKEN_KEY, 'hex') : null;
export function enc(s) {
  if (!s) return null; if (!KEY) throw new Error('TOKEN_KEY fehlt');
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv), out = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), out].map(b => b.toString('base64')).join('.');
}
export function dec(s) {
  if (!s) return null; const [iv, tag, data] = s.split('.').map(x => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv); d.setAuthTag(tag); return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}
