import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db, id, MEDIA_DIR, RENDER_DIR } from './db.js';
import { providers, startOAuth, finishOAuth, getIntegration } from './integrations.js';
import { render } from './render.js';
import { inviteMail, resetMail } from './mailer.js';
import { PLANS, ADDONS, ROLES, TRIAL_DAYS, INF, can, effPlan, limitsOf, priceId } from './plans.js';

const app = express(), PUB = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 8787}`;
app.use(cors({ origin: (process.env.CORS_ORIGIN || '*').split(',') }));
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), (req, res) => stripeWebhook(req, res));
app.use(express.json({ limit: '20mb' }));

const month = () => new Date().toISOString().slice(0, 7);
const org = oid => db.prepare('SELECT * FROM orgs WHERE id=?').get(oid);
const kiUsed = oid => db.prepare('SELECT n FROM usage WHERE org_id=? AND month=? AND kind=?').get(oid, month(), 'ki')?.n || 0;
const userOut = u => { if (!u) return null; const o = org(u.org_id), L = limitsOf(o);
  return { id: u.id, email: u.email, name: u.name, role: u.role, superadmin: !!u.superadmin, org: o.name, orgId: o.id, plan: L.plan, paid: !!o.paid, trialEnds: o.trial_ends && !o.paid ? o.trial_ends : null, cycle: o.cycle,
    limits: { projects: L.projects, seats: L.seats, ki: L.ki, publish: L.publish, analytics: L.analytics, approval: L.approval, whitelabel: L.whitelabel, exports: L.exports, watermark: L.watermark }, usage: { ki: kiUsed(o.id) }, addons: JSON.parse(o.addons || '{}'), created: u.created }; };
const loadUser = token => db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(token);
const session = u => { const token = crypto.randomBytes(32).toString('base64url'); db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, u.id, Date.now()); return token; };
const auth = (req, res, next) => { const t = (req.headers.authorization || '').replace(/^Bearer /, ''), u = t && loadUser(t); if (!u) return res.status(401).json({ error: 'Nicht angemeldet' }); req.user = u; req.org = org(u.org_id); req.token = t; next(); };
const need = perm => (req, res, next) => can(req.user, perm) ? next() : res.status(403).json({ error: 'Dafür fehlt dir die Berechtigung.' });
const superadmin = (req, res, next) => req.user.superadmin ? next() : res.status(403).json({ error: 'Nur für Plattform-Admins.' });
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => res.status(e.status || 400).json({ error: e.message }));
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
const seatsUsed = oid => db.prepare('SELECT COUNT(*) n FROM users WHERE org_id=?').get(oid).n + db.prepare('SELECT COUNT(*) n FROM invites WHERE org_id=?').get(oid).n;

// Plattform-Admin beim Start anlegen (Passwort nur aus .env, wird gehasht gespeichert)
(async () => {
  const email = (process.env.SUPERADMIN_EMAIL || '').toLowerCase(), pw = process.env.SUPERADMIN_PASSWORD;
  if (!email || !pw || db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return;
  const oid = id(); db.prepare("INSERT INTO orgs (id,name,plan,created,paid,internal) VALUES (?,?,?,?,1,1)").run(oid, process.env.SUPERADMIN_ORG || 'Plattform', 'agency', Date.now());
  db.prepare('INSERT INTO users (id,org_id,email,name,pw,role,created,superadmin) VALUES (?,?,?,?,?,?,?,1)').run(id(), oid, email, process.env.SUPERADMIN_NAME || 'Admin', await bcrypt.hash(pw, 12), 'owner', Date.now());
  console.log('Plattform-Admin angelegt:', email, '– SUPERADMIN_PASSWORD jetzt aus der .env entfernen.');
})();

const REG = process.env.REGISTRATION || 'invite'; // invite | open
app.get('/api/health', (_, res) => res.json({ ok: true, version: '0.3.0', platforms: Object.keys(providers), registration: REG }));

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), pw = String(req.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('Bitte eine gültige E-Mail angeben.');
  if (pw.length < 8) fail('Passwort braucht mindestens 8 Zeichen.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) fail('Für diese E-Mail gibt es schon ein Konto.');
  const inv = req.body.invite ? db.prepare('SELECT * FROM invites WHERE token=?').get(req.body.invite) : db.prepare('SELECT * FROM invites WHERE email=?').get(email);
  if (req.body.invite && (!inv || inv.email !== email)) fail('Die Einladung gilt für eine andere E-Mail-Adresse.');
  if (!inv && REG !== 'open') fail('Ad Studio ist aktuell nur auf Einladung verfügbar.', 403);
  const uid = id(), now = Date.now(); let oid, role;
  if (inv) { oid = inv.org_id; role = inv.role; db.prepare('DELETE FROM invites WHERE token=?').run(inv.token); }
  else { oid = id(); role = 'owner'; db.prepare('INSERT INTO orgs (id,name,plan,created,trial_ends) VALUES (?,?,?,?,?)').run(oid, req.body.org || '', 'pro', now, now + TRIAL_DAYS * 864e5); }
  db.prepare('INSERT INTO users (id,org_id,email,name,pw,role,created) VALUES (?,?,?,?,?,?,?)').run(uid, oid, email, req.body.name || email.split('@')[0], await bcrypt.hash(pw, 11), role, now);
  const token = session({ id: uid }); res.json({ token, user: userOut(loadUser(token)) });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase());
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.pw))) fail('E-Mail oder Passwort falsch.', 401);
  const token = session(u); res.json({ token, user: userOut(u) });
}));
app.get('/api/auth/me', auth, (req, res) => res.json({ user: userOut(req.user) }));
app.patch('/api/auth/me', auth, (req, res) => {
  if (req.body.name != null) db.prepare('UPDATE users SET name=? WHERE id=?').run(req.body.name, req.user.id);
  if (req.body.org != null && can(req.user, 'team')) db.prepare('UPDATE orgs SET name=? WHERE id=?').run(req.body.org, req.user.org_id);
  res.json({ user: userOut(loadUser(req.token)) });
});
app.post('/api/auth/password', auth, wrap(async (req, res) => {
  if (!(await bcrypt.compare(String(req.body.current || ''), req.user.pw))) fail('Aktuelles Passwort stimmt nicht.');
  if (String(req.body.next || '').length < 10) fail('Neues Passwort braucht mindestens 10 Zeichen.');
  db.prepare('UPDATE users SET pw=? WHERE id=?').run(await bcrypt.hash(req.body.next, 12), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(req.user.id, req.token); res.json({ ok: true });
}));
db.exec('CREATE TABLE IF NOT EXISTS password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT, expires INTEGER)');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
app.post('/api/auth/reset-request', wrap(async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase());
  if (u) { const t = crypto.randomBytes(32).toString('base64url'); db.prepare('DELETE FROM password_resets WHERE user_id=?').run(u.id); db.prepare('INSERT INTO password_resets VALUES (?,?,?)').run(sha(t), u.id, Date.now() + 3600e3); await resetMail(u.email, t); }
  res.json({ ok: true }); // immer ok – verrät nicht, ob die E-Mail existiert
}));
app.post('/api/auth/reset', wrap(async (req, res) => {
  const r = db.prepare('SELECT * FROM password_resets WHERE token_hash=?').get(sha(String(req.body.token || '')));
  if (!r || r.expires < Date.now()) fail('Der Link ist abgelaufen oder ungültig. Bitte neu anfordern.');
  if (String(req.body.password || '').length < 10) fail('Neues Passwort braucht mindestens 10 Zeichen.');
  db.prepare('UPDATE users SET pw=? WHERE id=?').run(await bcrypt.hash(req.body.password, 12), r.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id=?').run(r.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id);
  const token = session({ id: r.user_id }); res.json({ token, user: userOut(loadUser(token)) });
}));
app.post('/api/auth/logout', auth, (req, res) => { db.prepare('DELETE FROM sessions WHERE token=?').run(req.token); res.json({ ok: true }); });

// ---------- usage ----------
app.post('/api/usage', auth, need('ad.edit'), wrap((req, res) => {
  const n = Math.max(1, +req.body.n || 1), L = limitsOf(req.org), used = kiUsed(req.org.id);
  if (used + n > L.ki) fail('KI-Kontingent für diesen Monat aufgebraucht. Upgrade oder KI-Paket unter Konto → Abo.', 402);
  db.prepare('INSERT INTO usage VALUES (?,?,?,?) ON CONFLICT(org_id,month,kind) DO UPDATE SET n=n+excluded.n').run(req.org.id, month(), 'ki', n);
  res.json({ remaining: L.ki - used - n });
}));

// ---------- projects ----------
const visible = (u, p) => can(u, 'team') || p.access !== 'restricted' || (p.members || []).includes(u.id);
app.get('/api/projects', auth, (req, res) => res.json({ projects: db.prepare('SELECT data FROM projects WHERE org_id=? ORDER BY updated DESC').all(req.user.org_id).map(r => JSON.parse(r.data)).filter(p => visible(req.user, p)) }));
app.put('/api/projects/:id', auth, wrap((req, res) => {
  const ex = db.prepare('SELECT org_id, data FROM projects WHERE id=?').get(req.params.id);
  if (ex && ex.org_id !== req.user.org_id) fail('Kein Zugriff', 403);
  if (!ex) {
    if (!can(req.user, 'project.create')) fail('Deine Rolle darf keine Projekte anlegen.', 403);
    if (db.prepare('SELECT COUNT(*) n FROM projects WHERE org_id=?').get(req.user.org_id).n >= limitsOf(req.org).projects) fail('Projekt-Limit deines Plans erreicht.', 402);
  } else {
    const old = JSON.parse(ex.data), nw = req.body.data || {};
    if (!visible(req.user, old)) fail('Kein Zugriff auf dieses Projekt.', 403);
    if (!can(req.user, 'ad.edit') && !can(req.user, 'ad.approve')) fail('Nur Leserechte.', 403);
    if (!can(req.user, 'team') && ((old.access || 'all') !== (nw.access || 'all') || JSON.stringify(old.members || []) !== JSON.stringify(nw.members || []))) fail('Nur Inhaber und Admins vergeben Projekt-Zugriff.', 403);
  }
  const data = JSON.stringify(req.body.data);
  if (ex) db.prepare('INSERT INTO project_history (project_id,user_id,at,data) VALUES (?,?,?,?)').run(req.params.id, req.user.id, Date.now(), ex.data);
  db.prepare('INSERT OR REPLACE INTO projects VALUES (?,?,?,?,?)').run(req.params.id, req.user.org_id, data, Date.now(), req.user.id);
  db.prepare('DELETE FROM project_history WHERE project_id=? AND id NOT IN (SELECT id FROM project_history WHERE project_id=? ORDER BY id DESC LIMIT 50)').run(req.params.id, req.params.id);
  res.json({ ok: true });
}));
app.delete('/api/projects/:id', auth, need('project.delete'), (req, res) => { db.prepare('DELETE FROM projects WHERE id=? AND org_id=?').run(req.params.id, req.user.org_id); res.json({ ok: true }); });
app.get('/api/projects/:id/history', auth, (req, res) => res.json({ history: db.prepare('SELECT h.id, h.at, u.name FROM project_history h JOIN users u ON u.id=h.user_id JOIN projects p ON p.id=h.project_id WHERE h.project_id=? AND p.org_id=? ORDER BY h.id DESC').all(req.params.id, req.user.org_id) }));

// ---------- team ----------
const teamOut = oid => ({ members: db.prepare('SELECT id,email,name,role,superadmin,created FROM users WHERE org_id=? ORDER BY created').all(oid).map(m => ({ ...m, superadmin: !!m.superadmin })), invites: db.prepare('SELECT email,role,token,created at FROM invites WHERE org_id=?').all(oid) });
app.get('/api/team', auth, (req, res) => res.json(teamOut(req.user.org_id)));
app.post('/api/team/invites', auth, need('team'), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), role = req.body.role;
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('Bitte eine gültige E-Mail angeben.');
  if (!ROLES.includes(role) || role === 'owner') fail('Ungültige Rolle.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) fail('Diese E-Mail hat schon ein Konto.');
  db.prepare('DELETE FROM invites WHERE org_id=? AND email=?').run(req.user.org_id, email);
  if (seatsUsed(req.user.org_id) >= limitsOf(req.org).seats) fail('Alle Team-Plätze belegt. Upgrade oder Team-Platz dazubuchen.', 402);
  const tok = crypto.randomBytes(18).toString('base64url');
  db.prepare('INSERT INTO invites VALUES (?,?,?,?,?,?)').run(tok, req.user.org_id, email, role, req.user.id, Date.now());
  let mailed = true; try { await inviteMail(email, req.org.name, req.user.name, { admin: 'Admin', editor: 'Editor', reviewer: 'Reviewer', viewer: 'Leser' }[role], tok); } catch (e) { mailed = false; }
  res.json({ invites: teamOut(req.user.org_id).invites, mailed: mailed && !!process.env.RESEND_API_KEY });
}));
app.delete('/api/team/invites/:email', auth, need('team'), (req, res) => { db.prepare('DELETE FROM invites WHERE org_id=? AND email=?').run(req.user.org_id, req.params.email); res.json({ invites: teamOut(req.user.org_id).invites }); });
app.patch('/api/team/members/:id', auth, need('team'), wrap((req, res) => {
  const t = db.prepare('SELECT * FROM users WHERE id=? AND org_id=?').get(req.params.id, req.user.org_id), role = req.body.role; if (!t || !ROLES.includes(role)) fail('Unbekanntes Mitglied.');
  if ((role === 'owner' || t.role === 'owner') && req.user.role !== 'owner' && !req.user.superadmin) fail('Nur Inhaber können Inhaber ändern.', 403);
  if (t.role === 'owner' && role !== 'owner' && db.prepare("SELECT COUNT(*) n FROM users WHERE org_id=? AND role='owner'").get(req.user.org_id).n < 2) fail('Es muss mindestens einen Inhaber geben.');
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, t.id); res.json(teamOut(req.user.org_id));
}));
app.delete('/api/team/members/:id', auth, need('team'), wrap((req, res) => {
  const t = db.prepare('SELECT * FROM users WHERE id=? AND org_id=?').get(req.params.id, req.user.org_id); if (!t) fail('Unbekanntes Mitglied.');
  if (t.id === req.user.id) fail('Du kannst dich nicht selbst entfernen.');
  if (t.role === 'owner' && db.prepare("SELECT COUNT(*) n FROM users WHERE org_id=? AND role='owner'").get(req.user.org_id).n < 2) fail('Der letzte Inhaber kann nicht entfernt werden.');
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(t.id); db.prepare('DELETE FROM users WHERE id=?').run(t.id); res.json(teamOut(req.user.org_id));
}));

// ---------- billing (Stripe REST, ohne SDK) ----------
const stripe = async (pathname, params, method = 'POST') => {
  if (!process.env.STRIPE_SECRET_KEY) fail('Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY).', 501);
  const body = new URLSearchParams(); const add = (k, v) => { if (v && typeof v === 'object') Object.entries(v).forEach(([kk, vv]) => add(`${k}[${kk}]`, vv)); else if (v != null) body.append(k, String(v)); };
  Object.entries(params || {}).forEach(([k, v]) => add(k, v));
  const r = await fetch('https://api.stripe.com/v1/' + pathname, { method, headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY }, body: method === 'GET' ? undefined : body });
  const j = await r.json(); if (!r.ok) fail(j.error?.message || 'Stripe-Fehler'); return j;
};
const customer = async (o, email) => { if (o.stripe_customer) return o.stripe_customer; const c = await stripe('customers', { email, name: o.name || email, metadata: { org_id: o.id } }); db.prepare('UPDATE orgs SET stripe_customer=? WHERE id=?').run(c.id, o.id); return c.id; };
app.post('/api/billing/checkout', auth, need('billing'), wrap(async (req, res) => {
  const { plan, cycle = 'monthly', returnUrl } = req.body; if (!PLANS[plan]) fail('Unbekannter Plan.');
  if (plan === 'free') { if (req.org.stripe_sub) await stripe('subscriptions/' + req.org.stripe_sub, { cancel_at_period_end: true }); return res.json({ ok: true, url: null }); }
  const price = priceId(plan, cycle); if (!price) fail(`Preis fehlt: STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`, 501);
  if (req.org.stripe_sub) { // Planwechsel im laufenden Abo
    const sub = await stripe('subscriptions/' + req.org.stripe_sub, null, 'GET');
    await stripe('subscriptions/' + sub.id, { items: { 0: { id: sub.items.data[0].id, price } }, proration_behavior: 'create_prorations', metadata: { org_id: req.org.id, plan, cycle } });
    db.prepare('UPDATE orgs SET plan=?, cycle=?, paid=1, trial_ends=NULL WHERE id=?').run(plan, cycle, req.org.id); return res.json({ ok: true, url: returnUrl + '?billing=success' });
  }
  const s = await stripe('checkout/sessions', { mode: 'subscription', customer: await customer(req.org, req.user.email), 'line_items[0][price]': price, 'line_items[0][quantity]': 1, allow_promotion_codes: true, automatic_tax: { enabled: true }, customer_update: { address: 'auto' },
    success_url: returnUrl + '?billing=success', cancel_url: returnUrl, client_reference_id: req.org.id, subscription_data: { metadata: { org_id: req.org.id, plan, cycle } } });
  res.json({ url: s.url });
}));
app.post('/api/billing/addon', auth, need('billing'), wrap(async (req, res) => {
  const A = ADDONS[req.body.key], price = priceId('addon_' + req.body.key); if (!A || !price) fail('Add-on nicht konfiguriert.', 501);
  if (A.minPlan === 'pro' && !['pro', 'agency'].includes(effPlan(req.org))) fail('White-Label gibt es ab Pro.');
  const s = await stripe('checkout/sessions', { mode: A.mode, customer: await customer(req.org, req.user.email), 'line_items[0][price]': price, 'line_items[0][quantity]': 1, success_url: req.body.returnUrl + '?billing=success', cancel_url: req.body.returnUrl, client_reference_id: req.org.id, metadata: { org_id: req.org.id, addon: req.body.key }, ...(A.mode === 'subscription' ? { subscription_data: { metadata: { org_id: req.org.id, addon: req.body.key } } } : {}) });
  res.json({ url: s.url });
}));
app.post('/api/billing/portal', auth, need('billing'), wrap(async (req, res) => { const s = await stripe('billing_portal/sessions', { customer: await customer(req.org, req.user.email), return_url: req.body.returnUrl }); res.json({ url: s.url }); }));
app.get('/api/billing/invoices', auth, need('billing'), wrap(async (req, res) => { if (!req.org.stripe_customer) return res.json({ invoices: [] }); const j = await stripe('invoices?customer=' + req.org.stripe_customer + '&limit=24', null, 'GET'); res.json({ invoices: j.data.map(i => ({ id: i.id, number: i.number, total: i.total / 100, status: i.status, at: i.created * 1000, pdf: i.invoice_pdf })) }); }));

function stripeWebhook(req, res) {
  try {
    const sig = String(req.headers['stripe-signature'] || ''), parts = Object.fromEntries(sig.split(',').map(x => x.split('='))), raw = req.body.toString('utf8');
    const exp = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || '').update(parts.t + '.' + raw).digest('hex');
    if (!parts.v1 || !crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(parts.v1)) || Math.abs(Date.now() / 1000 - +parts.t) > 300) return res.status(400).send('bad signature');
    const ev = JSON.parse(raw), o = ev.data.object, meta = o.metadata || {}, oid = meta.org_id || o.client_reference_id;
    if (db.prepare('SELECT 1 FROM billing_events WHERE id=?').get(ev.id)) return res.json({ ok: true });
    db.prepare('INSERT INTO billing_events VALUES (?,?,?,?,?)').run(ev.id, ev.type, oid || null, Date.now(), raw.slice(0, 20000));
    const addAddon = (key, d) => { const og = org(oid); if (!og) return; const a = JSON.parse(og.addons || '{}'); a[key] = Math.max(0, (a[key] || 0) + d); db.prepare('UPDATE orgs SET addons=? WHERE id=?').run(JSON.stringify(a), oid); };
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && !meta.addon) db.prepare('UPDATE orgs SET stripe_sub=?, paid=1, trial_ends=NULL WHERE id=?').run(o.subscription, oid);
    if (ev.type === 'checkout.session.completed' && meta.addon) addAddon(meta.addon, 1);
    if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.created') {
      if (meta.plan && !meta.addon) db.prepare('UPDATE orgs SET plan=?, cycle=?, paid=?, trial_ends=NULL WHERE id=?').run(meta.plan, meta.cycle || 'monthly', ['active', 'trialing', 'past_due'].includes(o.status) ? 1 : 0, oid);
    }
    if (ev.type === 'customer.subscription.deleted') { if (meta.addon) addAddon(meta.addon, -1); else db.prepare("UPDATE orgs SET plan='free', paid=0, stripe_sub=NULL WHERE id=?").run(oid); }
    res.json({ ok: true });
  } catch (e) { res.status(400).send(e.message); }
}

// ---------- super-admin ----------
app.get('/api/admin/overview', auth, superadmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM orgs ORDER BY created DESC').all().map(o => {
    const pl = effPlan(o), ad = JSON.parse(o.addons || '{}'), mrr = o.paid && !o.internal ? (o.cycle === 'yearly' ? PLANS[pl].price * 0.8 : PLANS[pl].price) + 9 * (ad.seat || 0) + 49 * (ad.whitelabel || 0) : 0;
    return { id: o.id, name: o.name || '(ohne Namen)', plan: pl, paid: !!o.paid, internal: !!o.internal, trial: !!(o.trial_ends && !o.paid && Date.now() < o.trial_ends), created: o.created, mrr,
      members: db.prepare('SELECT COUNT(*) n FROM users WHERE org_id=?').get(o.id).n, projects: db.prepare('SELECT COUNT(*) n FROM projects WHERE org_id=?').get(o.id).n,
      owner: db.prepare("SELECT email FROM users WHERE org_id=? AND role='owner' LIMIT 1").get(o.id)?.email || '' };
  });
  res.json({ orgs: rows, totals: { orgs: rows.length, users: db.prepare('SELECT COUNT(*) n FROM users').get().n, paying: rows.filter(r => r.mrr > 0).length, trials: rows.filter(r => r.trial).length, mrr: rows.reduce((a, r) => a + r.mrr, 0) } });
});
app.post('/api/admin/invite-customer', auth, superadmin, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), plan = PLANS[req.body.plan] ? req.body.plan : 'pro';
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('Bitte eine gültige E-Mail angeben.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) fail('Diese E-Mail hat schon ein Konto.');
  const oid = id(), tok = crypto.randomBytes(18).toString('base64url'), now = Date.now();
  db.prepare('INSERT INTO orgs (id,name,plan,created,trial_ends) VALUES (?,?,?,?,?)').run(oid, req.body.org || '', plan, now, now + TRIAL_DAYS * 864e5);
  db.prepare('INSERT INTO invites VALUES (?,?,?,?,?,?)').run(tok, oid, email, 'owner', req.user.id, now);
  try { await inviteMail(email, req.body.org || 'Ad Studio', req.user.name, 'Inhaber', tok); } catch (e) {}
  res.json({ ok: true, link: (process.env.APP_URL || '') + '?invite=' + tok });
}));
app.patch('/api/admin/orgs/:id', auth, superadmin, (req, res) => {
  if (!PLANS[req.body.plan]) return res.status(400).json({ error: 'Unbekannter Plan' });
  db.prepare('UPDATE orgs SET plan=?, paid=?, trial_ends=NULL WHERE id=?').run(req.body.plan, req.body.plan === 'free' ? 0 : 1, req.params.id); res.json({ ok: true });
});

// ---------- media ----------
const upload = multer({ storage: multer.diskStorage({ destination: MEDIA_DIR, filename: (req, f, cb) => cb(null, id() + path.extname(f.originalname || '')) }), limits: { fileSize: 2 * 1024 ** 3 } });
app.post('/api/media', auth, need('ad.edit'), upload.single('file'), (req, res) => {
  const mid = req.body.id || id(); db.prepare('INSERT OR REPLACE INTO media VALUES (?,?,?,?,?,?,?)').run(mid, req.user.org_id, req.body.project || null, req.file.filename, req.file.mimetype, req.file.size, Date.now());
  res.json({ id: mid, url: `${PUB}/media/${mid}` });
});
app.get('/media/:id', (req, res) => { const m = db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id); if (!m) return res.sendStatus(404); res.type(m.mime).sendFile(path.resolve(MEDIA_DIR, m.file)); });
app.delete('/api/media/:id', auth, need('ad.edit'), (req, res) => { const m = db.prepare('SELECT * FROM media WHERE id=? AND org_id=?').get(req.params.id, req.user.org_id); if (m) { fs.rm(path.join(MEDIA_DIR, m.file), () => {}); db.prepare('DELETE FROM media WHERE id=?').run(m.id); } res.json({ ok: true }); });

// ---------- integrations (OAuth) ----------
const listInt = o => Object.fromEntries(db.prepare('SELECT platform, account, connected, expires FROM integrations WHERE org_id=?').all(o).map(r => [r.platform, { account: r.account, connected: r.connected, expires: r.expires }]));
app.get('/api/integrations', auth, (req, res) => res.json({ integrations: listInt(req.user.org_id) }));
app.post('/api/integrations/:p/start', auth, need('integrations'), wrap((req, res) => res.json({ url: startOAuth(req.user.org_id, req.params.p) })));
app.delete('/api/integrations/:p', auth, need('integrations'), (req, res) => { db.prepare('DELETE FROM integrations WHERE org_id=? AND platform=?').run(req.user.org_id, req.params.p); res.json({ integrations: listInt(req.user.org_id) }); });
app.get('/oauth/:p/callback', async (req, res) => {
  try { await finishOAuth(req.params.p, req.query.code, req.query.state); res.send('<p style="font-family:sans-serif">Verbunden. Dieses Fenster kann geschlossen werden.</p><script>setTimeout(()=>close(),800)</script>'); }
  catch (e) { res.status(400).send('<p style="font-family:sans-serif">Verbindung fehlgeschlagen: ' + String(e.message).replace(/</g, '&lt;') + '</p>'); }
});

// ---------- render & export ----------
const checkFormat = (req, spec) => { const L = limitsOf(req.org); if (!L.exports.includes(spec.format || 'mp4')) fail('Dieses Exportformat ist in deinem Plan nicht enthalten.', 402); spec.watermark = L.watermark; return spec; };
app.post('/api/render', auth, wrap((req, res) => {
  const spec = checkFormat(req, req.body.spec), jid = id();
  db.prepare('INSERT INTO renders VALUES (?,?,?,?,?,?,?)').run(jid, req.user.org_id, 'queued', spec.format || 'mp4', null, null, Date.now());
  render(jid, spec); res.json({ job: { id: jid, status: 'queued' } });
}));
app.get('/api/render/:id', auth, (req, res) => {
  const r = db.prepare('SELECT * FROM renders WHERE id=? AND org_id=?').get(req.params.id, req.user.org_id); if (!r) return res.sendStatus(404);
  res.json({ job: { id: r.id, status: r.status, error: r.error, url: r.status === 'done' ? `${PUB}/renders/${r.file}` : null } });
});
app.use('/renders', express.static(RENDER_DIR));

// ---------- publishing ----------
app.post('/api/publish', auth, need('publish'), wrap(async (req, res) => {
  if (!limitsOf(req.org).publish) fail('Direkt-Posting gibt es ab dem Starter-Plan.', 402);
  const { platform, projectId, adKey, caption, title, targetUrl } = req.body, spec = checkFormat(req, req.body.spec), o = req.user.org_id;
  const it = await getIntegration(o, platform); if (!it) fail('Plattform nicht verbunden.');
  const pid = id(), track = targetUrl ? `${PUB}/l/${pid}` : '';
  db.prepare('INSERT INTO publications VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(pid, o, projectId, adKey, platform, 'rendering', null, null, targetUrl || null, null, Date.now());
  res.json({ publication: { id: pid, status: 'rendering', trackUrl: track } });
  try {
    const jid = id(); db.prepare('INSERT INTO renders VALUES (?,?,?,?,?,?,?)').run(jid, o, 'queued', spec.format || 'mp4', null, null, Date.now());
    const r = await render(jid, spec); if (!r.ok) throw new Error('Rendern fehlgeschlagen');
    db.prepare('UPDATE publications SET status=? WHERE id=?').run('uploading', pid);
    const out = await providers[platform].publish(it, { filePath: r.out, videoUrl: `${PUB}/renders/${path.basename(r.out)}`, caption: [caption, track].filter(Boolean).join('\n\n'), title, isImage: spec.format === 'jpg' });
    db.prepare('UPDATE publications SET status=?, remote_id=?, url=? WHERE id=?').run('published', out.remote_id, out.url, pid);
  } catch (e) { db.prepare('UPDATE publications SET status=?, error=? WHERE id=?').run('error', e.message, pid); }
}));
app.get('/api/publications', auth, (req, res) => res.json({ publications: db.prepare('SELECT p.*, (SELECT COUNT(*) FROM clicks c WHERE c.pub_id=p.id) clicks FROM publications p WHERE org_id=? AND (? IS NULL OR project_id=?) ORDER BY created DESC').all(req.user.org_id, req.query.project || null, req.query.project || null) }));
app.get('/api/publications/:id/stats', auth, wrap(async (req, res) => {
  const p = db.prepare('SELECT * FROM publications WHERE id=? AND org_id=?').get(req.params.id, req.user.org_id); if (!p) return res.sendStatus(404);
  let s = db.prepare('SELECT * FROM stats WHERE pub_id=?').get(p.id);
  if (limitsOf(req.org).analytics && p.remote_id && (!s || Date.now() - s.fetched > 15 * 60e3)) {
    const it = await getIntegration(p.org_id, p.platform), x = await providers[p.platform].stats(it, p.remote_id);
    db.prepare('INSERT OR REPLACE INTO stats VALUES (?,?,?,?,?,?)').run(p.id, x.views, x.likes, x.shares, x.comments, Date.now()); s = { ...x, fetched: Date.now() };
  }
  const clicks = db.prepare('SELECT COUNT(*) n FROM clicks WHERE pub_id=?').get(p.id).n, views = s?.views || 0;
  res.json({ stats: { status: p.status, error: p.error, url: p.url, views, likes: s?.likes || 0, shares: s?.shares || 0, comments: s?.comments || 0, clicks, ctr: views ? clicks / views : 0, fetched: s?.fetched || null } });
}));
app.get('/l/:id', (req, res) => {
  const p = db.prepare('SELECT target_url FROM publications WHERE id=?').get(req.params.id); if (!p?.target_url) return res.sendStatus(404);
  db.prepare('INSERT INTO clicks VALUES (?,?,?)').run(req.params.id, Date.now(), req.get('referer') || ''); res.redirect(302, p.target_url);
});

app.listen(process.env.PORT || 8787, () => console.log('Ad Studio API läuft auf', PUB));
