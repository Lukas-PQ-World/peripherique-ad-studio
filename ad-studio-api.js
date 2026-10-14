// Ad Studio API client. mode 'local' = Demo-Backend im Browser (IndexedDB), mode 'remote' = REST-Server (backend/).
(function () {
const CFG_KEY = 'ad-studio-api-cfg', TOK_KEY = 'ad-studio-token';
// API_BASE leer = Demo-Modus (alles im Browser, z. B. Cloudflare Pages ohne Server).
// Sobald das Backend läuft, hier die URL eintragen, z. B. 'https://api.ad-studio.peripherique.de'.
const API_BASE = window.AS_API_BASE || '';
const cfg = () => { let c = {}; try { c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) {} return API_BASE && !c.mode ? { mode: 'remote', base: API_BASE } : c; };
const PLATFORMS = {
  instagram: { label: 'Instagram', ch: 'meta', short: 'IG', color: '#e1306c' },
  tiktok: { label: 'TikTok', ch: 'tiktok', short: 'TT', color: '#25f4ee' },
  youtube: { label: 'YouTube', ch: 'youtube', short: 'YT', color: '#ff3d3d' },
};
const EXPORTS = [['mp4', 'MP4 · H.264'], ['mov', 'MOV · ProRes 422'], ['webm', 'WebM · VP9'], ['gif', 'GIF · Vorschau'], ['jpg', 'JPG · Standbild']];

// ---------- SaaS: Pläne, Add-ons, Rollen ----------
const INF = 1e9;
const PLANS = {
  free: { label: 'Free', price: 0, projects: 1, seats: 1, ki: 20, publish: false, analytics: false, approval: false, whitelabel: false, exports: ['mp4', 'jpg'], watermark: true,
    features: ['1 Projekt', '1 Nutzer', '20 KI-Aktionen / Monat', 'Export MP4 & JPG mit Wasserzeichen'] },
  starter: { label: 'Starter', price: 29, projects: 5, seats: 3, ki: 200, publish: true, analytics: true, approval: false, whitelabel: false, exports: ['mp4', 'jpg', 'gif'], watermark: false,
    features: ['5 Projekte', '3 Nutzer', '200 KI-Aktionen / Monat', 'Direkt-Posting Instagram, TikTok, YouTube', 'Views, Klicks, CTR'] },
  pro: { label: 'Pro', price: 79, projects: INF, seats: 10, ki: 1000, publish: true, analytics: true, approval: true, whitelabel: false, exports: ['mp4', 'mov', 'webm', 'gif', 'jpg'], watermark: false, highlight: true,
    features: ['Unbegrenzte Projekte', '10 Nutzer mit Rollen', '1.000 KI-Aktionen / Monat', 'Freigabe-Workflow', 'Alle Exportformate inkl. ProRes'] },
  agency: { label: 'Agency', price: 199, projects: INF, seats: 30, ki: 5000, publish: true, analytics: true, approval: true, whitelabel: true, exports: ['mp4', 'mov', 'webm', 'gif', 'jpg'], watermark: false,
    features: ['Alles aus Pro', '30 Nutzer', '5.000 KI-Aktionen / Monat', 'White-Label ohne Ad-Studio-Branding', 'Priorisiertes Rendering & Support'] },
};
const ADDONS = {
  ki500: { label: '+500 KI-Aktionen', price: 9, unit: 'einmalig', ki: 500 },
  seat: { label: '+1 Team-Platz', price: 9, unit: '/ Monat', seats: 1 },
  whitelabel: { label: 'White-Label', price: 49, unit: '/ Monat', whitelabel: true, minPlan: 'pro' },
};
const ROLES = { owner: 'Inhaber', admin: 'Admin', editor: 'Editor', reviewer: 'Reviewer', viewer: 'Nur lesen' };
const ROLE_INFO = { owner: 'Alles inkl. Abo & Abrechnung', admin: 'Team, Plattformen, Veröffentlichen', editor: 'Projekte & Ads bearbeiten', reviewer: 'Ads prüfen & freigeben', viewer: 'Nur ansehen' };
const PERMS = {
  billing: ['owner'], team: ['owner', 'admin'], integrations: ['owner', 'admin'], publish: ['owner', 'admin'],
  'project.create': ['owner', 'admin', 'editor'], 'project.delete': ['owner', 'admin'], 'ad.edit': ['owner', 'admin', 'editor'], 'ad.approve': ['owner', 'admin', 'reviewer'],
};
const TRIAL_DAYS = 14;
const effPlan = o => (o.trialEnds && !o.paid && Date.now() > o.trialEnds) ? 'free' : (o.plan || 'free');
const limitsOf = o => {
  const P = PLANS[effPlan(o)] || PLANS.free, ad = o.addons || {};
  return { ...P, plan: effPlan(o), seats: P.seats + (ad.seat || 0), ki: P.ki + 500 * (ad.ki500 || 0), whitelabel: P.whitelabel || !!ad.whitelabel };
};
const can = (u, perm) => !!u && (u.superadmin || (PERMS[perm] || []).includes(u.role));
const visible = (u, p) => can(u, 'team') || p.access !== 'restricted' || (p.members || []).includes(u.id);
const month = () => new Date().toISOString().slice(0, 7);

// ---------- local demo backend ----------
const DB = {
  db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open('ad-studio-api', 1); r.onupgradeneeded = () => { ['users', 'projects', 'kv'].forEach(n => r.result.createObjectStore(n)); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async tx(store, mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); let out; const q = fn(s); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); },
  get(s, k) { return this.tx(s, 'readonly', st => st.get(k)); },
  put(s, k, v) { return this.tx(s, 'readwrite', st => st.put(v, k)); },
  del(s, k) { return this.tx(s, 'readwrite', st => st.delete(k)); },
  all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
};
const hash = async (pw, salt) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pw)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const err = m => { throw new Error(m); };

// Plattform-Betreiber (Super-Admin). Passwort wird nur als Hash gespeichert.
const ROOT = { email: 'l.burczyk@pq-world.de', name: 'L. Burczyk', salt: 'a12lzbmm2zpip1r5', pw: 'abdce602bf9c14e915ad80539a3272ae08bd798bedc297c89b14e51e21cd7da2', orgId: 'org-pq', org: 'PQ World' };

const local = {
  ready: null,
  init() {
    return this.ready || (this.ready = (async () => {
      if (!(await DB.get('users', ROOT.email))) {
        await DB.put('users', ROOT.email, { id: 'u-root', email: ROOT.email, name: ROOT.name, salt: ROOT.salt, pw: ROOT.pw, orgId: ROOT.orgId, role: 'owner', superadmin: true, created: Date.now() });
        if (!(await DB.get('kv', 'org:' + ROOT.orgId))) await DB.put('kv', 'org:' + ROOT.orgId, { type: 'org', id: ROOT.orgId, name: ROOT.org, plan: 'agency', paid: true, internal: true, addons: {}, usage: {}, invites: [], integrations: {}, created: Date.now() });
      }
    })());
  },
  async org(id) { return DB.get('kv', 'org:' + id); },
  async saveOrg(o) { await DB.put('kv', 'org:' + o.id, o); return o; },
  async orgs() { return (await DB.all('kv')).filter(x => x && x.type === 'org'); },
  async ensureOrg(u) {
    if (u.orgId && await this.org(u.orgId)) return this.org(u.orgId);
    const o = { type: 'org', id: u.orgId || u.id, name: u.org || '', plan: 'pro', trialEnds: Date.now() + TRIAL_DAYS * 864e5, paid: false, addons: {}, usage: {}, invites: [], integrations: u.integrations || {}, created: Date.now() };
    u.orgId = o.id; u.role = u.role === 'owner' || !u.role ? 'owner' : u.role; delete u.integrations; delete u.plan; delete u.org;
    await DB.put('users', u.email, u); return this.saveOrg(o);
  },
  async ctx() { await this.init(); const t = localStorage.getItem(TOK_KEY); if (!t) return null; const e = await DB.get('kv', 'sess:' + t); const u = e && await DB.get('users', e); if (!u) return null; const o = await this.ensureOrg(u); return { u, o }; },
  async need(perm) { const c = await this.ctx(); if (!c) err('Nicht angemeldet.'); if (perm && !can(c.u, perm)) err('Dafür fehlt dir die Berechtigung (Rolle: ' + ROLES[c.u.role] + ').'); return c; },
  pub(u, o) {
    const L = limitsOf(o), ki = (o.usage || {})[month()] || 0;
    return { id: u.id, email: u.email, name: u.name, role: u.role, superadmin: !!u.superadmin, org: o.name, orgId: o.id, plan: L.plan, paid: !!o.paid, trialEnds: o.trialEnds && !o.paid ? o.trialEnds : null, cycle: o.cycle || 'monthly',
      limits: { projects: L.projects, seats: L.seats, ki: L.ki, publish: L.publish, analytics: L.analytics, approval: L.approval, whitelabel: L.whitelabel, exports: L.exports, watermark: L.watermark }, usage: { ki }, addons: o.addons || {}, created: u.created };
  },
  async session(u) { const token = 'local.' + rid(); await DB.put('kv', 'sess:' + token, u.email); localStorage.setItem(TOK_KEY, token); return this.me(); },
  async register({ email, password, name, org }) {
    await this.init(); email = (email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) err('Bitte eine gültige E-Mail angeben.');
    if ((password || '').length < 8) err('Passwort braucht mindestens 8 Zeichen.');
    if (await DB.get('users', email)) err('Für diese E-Mail gibt es schon ein Konto.');
    const salt = rid(), u = { id: rid(), email, name: (name || '').trim() || email.split('@')[0], salt, pw: await hash(password, salt), created: Date.now() };
    const inv = (await this.orgs()).map(o => ({ o, i: (o.invites || []).find(i => i.email === email) })).find(x => x.i);
    if (inv) { u.orgId = inv.o.id; u.role = inv.i.role; inv.o.invites = inv.o.invites.filter(i => i.email !== email); await this.saveOrg(inv.o); }
    else { u.orgId = rid(); u.role = 'owner'; await this.saveOrg({ type: 'org', id: u.orgId, name: (org || '').trim(), plan: 'pro', trialEnds: Date.now() + TRIAL_DAYS * 864e5, paid: false, addons: {}, usage: {}, invites: [], integrations: {}, created: Date.now() }); }
    await DB.put('users', email, u); return this.session(u);
  },
  async login({ email, password }) {
    await this.init(); const u = await DB.get('users', (email || '').trim().toLowerCase());
    if (!u || u.pw !== await hash(password || '', u.salt)) err('E-Mail oder Passwort falsch.');
    return this.session(u);
  },
  async me() { const c = await this.ctx(); return c ? this.pub(c.u, c.o) : null; },
  async logout() { const t = localStorage.getItem(TOK_KEY); if (t) await DB.del('kv', 'sess:' + t); localStorage.removeItem(TOK_KEY); },
  async requestReset() { err('Im Demo-Modus gibt es keinen Mail-Versand. Auf dem Server kommt der Link per E-Mail.'); },
  async resetPassword() { err('Nur im Server-Modus verfügbar.'); },
  async changePassword({ current, next }) {
    const { u } = await this.need(); if (u.pw !== await hash(current || '', u.salt)) err('Aktuelles Passwort stimmt nicht.');
    if ((next || '').length < 10) err('Neues Passwort braucht mindestens 10 Zeichen.');
    u.salt = rid(); u.pw = await hash(next, u.salt); await DB.put('users', u.email, u); return true;
  },
  async updateMe(patch) {
    const { u, o } = await this.need(); if (patch.name != null) { u.name = patch.name; await DB.put('users', u.email, u); }
    if (patch.org != null && can(u, 'team')) { o.name = patch.org; await this.saveOrg(o); } return this.pub(u, o);
  },
  async listProjects() { const { u, o } = await this.need(); return (await DB.all('projects')).filter(p => p.owner === o.id && visible(u, p.data)).map(p => p.data); },
  async saveProject(p) {
    const { u, o } = await this.need(), ex = await DB.get('projects', p.id);
    if (ex && ex.owner !== o.id) err('Kein Zugriff auf dieses Projekt.');
    if (!ex) { if (!can(u, 'project.create')) err('Deine Rolle darf keine Projekte anlegen.'); const n = (await DB.all('projects')).filter(x => x.owner === o.id).length; if (n >= limitsOf(o).projects) err('Projekt-Limit deines Plans erreicht.'); }
    else {
      if (!visible(u, ex.data)) err('Kein Zugriff auf dieses Projekt.');
      if (!can(u, 'ad.edit') && !can(u, 'ad.approve')) err('Nur Leserechte.');
      if (!can(u, 'team') && ((ex.data.access || 'all') !== (p.access || 'all') || JSON.stringify(ex.data.members || []) !== JSON.stringify(p.members || []))) err('Nur Inhaber und Admins vergeben Projekt-Zugriff.');
    }
    await DB.put('projects', p.id, { owner: o.id, data: p, updated: Date.now(), by: u.id });
  },
  async deleteProject(id) { const { o } = await this.need('project.delete'), ex = await DB.get('projects', id); if (ex && ex.owner === o.id) await DB.del('projects', id); },
  async putMedia(id, blob) { await window.ASCore.IDB.put(id, blob); return 'idb:' + id; },
  async getMedia(id) { return window.ASCore.IDB.get(id); },
  async delMedia(id) { return window.ASCore.IDB.del(id); },
  async integrations() { const c = await this.ctx(); return c ? c.o.integrations || {} : {}; },
  async connect(platform, account) { const { o } = await this.need('integrations'); o.integrations = o.integrations || {}; o.integrations[platform] = { account: account || '@demo', connected: Date.now(), demo: true }; await this.saveOrg(o); return o.integrations; },
  async disconnect(platform) { const { o } = await this.need('integrations'); delete (o.integrations || {})[platform]; await this.saveOrg(o); return o.integrations; },
  async useCredit(kind = 'ki', n = 1) {
    const { o } = await this.need(), m = month(), L = limitsOf(o); o.usage = o.usage || {};
    if ((o.usage[m] || 0) + n > L.ki) err('KI-Kontingent für diesen Monat aufgebraucht. Upgrade oder KI-Paket unter Konto → Abo.');
    o.usage[m] = (o.usage[m] || 0) + n; await this.saveOrg(o); return L.ki - o.usage[m];
  },
  // team
  async team() {
    const { o } = await this.need(), users = (await DB.all('users')).filter(x => x.orgId === o.id);
    return { members: users.map(x => ({ id: x.id, email: x.email, name: x.name, role: x.role, superadmin: !!x.superadmin, created: x.created })), invites: o.invites || [] };
  },
  async invite({ email, role }) {
    const { o } = await this.need('team'); email = (email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) err('Bitte eine gültige E-Mail angeben.');
    if (!ROLES[role] || role === 'owner') err('Ungültige Rolle.');
    const users = (await DB.all('users')).filter(x => x.orgId === o.id); if (users.some(x => x.email === email)) err('Diese Person ist schon im Team.');
    if (users.length + (o.invites || []).length >= limitsOf(o).seats) err('Alle Team-Plätze belegt. Upgrade oder Team-Platz dazubuchen.');
    if (await DB.get('users', email)) err('Diese E-Mail gehört schon zu einem anderen Konto.');
    o.invites = (o.invites || []).filter(i => i.email !== email).concat([{ email, role, token: rid(), at: Date.now() }]); await this.saveOrg(o); return o.invites;
  },
  async revokeInvite(email) { const { o } = await this.need('team'); o.invites = (o.invites || []).filter(i => i.email !== email); await this.saveOrg(o); return o.invites; },
  async setRole(userId, role) {
    const { u, o } = await this.need('team'), users = (await DB.all('users')).filter(x => x.orgId === o.id), t = users.find(x => x.id === userId); if (!t || !ROLES[role]) err('Unbekanntes Mitglied.');
    if ((role === 'owner' || t.role === 'owner') && u.role !== 'owner' && !u.superadmin) err('Nur Inhaber können Inhaber ändern.');
    if (t.role === 'owner' && role !== 'owner' && users.filter(x => x.role === 'owner').length < 2) err('Es muss mindestens einen Inhaber geben.');
    t.role = role; await DB.put('users', t.email, t); return this.team();
  },
  async removeMember(userId) {
    const { u, o } = await this.need('team'), users = (await DB.all('users')).filter(x => x.orgId === o.id), t = users.find(x => x.id === userId); if (!t) err('Unbekanntes Mitglied.');
    if (t.id === u.id) err('Du kannst dich nicht selbst entfernen.'); if (t.role === 'owner' && users.filter(x => x.role === 'owner').length < 2) err('Der letzte Inhaber kann nicht entfernt werden.');
    await DB.del('users', t.email); return this.team();
  },
  // billing (Demo: sofort umgestellt, keine Zahlung)
  async subscribe(plan, cycle) { const { o } = await this.need('billing'); if (!PLANS[plan]) err('Unbekannter Plan.'); Object.assign(o, { plan, cycle: cycle || 'monthly', paid: plan !== 'free', trialEnds: null }); await this.saveOrg(o); return { demo: true }; },
  async buyAddon(key) { const { o } = await this.need('billing'), A = ADDONS[key]; if (!A) err('Unbekanntes Add-on.'); if (A.minPlan === 'pro' && !['pro', 'agency'].includes(effPlan(o))) err('White-Label gibt es ab Pro.'); o.addons = o.addons || {}; o.addons[key] = (o.addons[key] || 0) + 1; await this.saveOrg(o); return { demo: true }; },
  async invoices() { return []; },
  async portal() { err('Rechnungen & Zahlungsarten gibt es im Server-Modus über Stripe.'); },
  // super-admin
  async adminOverview() {
    const { u } = await this.need(); if (!u.superadmin) err('Nur für Plattform-Admins.');
    const orgs = await this.orgs(), users = await DB.all('users'), projects = await DB.all('projects');
    const rows = orgs.map(o => { const pl = effPlan(o), mrr = o.paid && !o.internal ? (o.cycle === 'yearly' ? PLANS[pl].price * 0.8 : PLANS[pl].price) + 9 * ((o.addons || {}).seat || 0) + 49 * ((o.addons || {}).whitelabel || 0) : 0;
      return { id: o.id, name: o.name || '(ohne Namen)', plan: pl, paid: !!o.paid, trial: !!(o.trialEnds && !o.paid && Date.now() < o.trialEnds), internal: !!o.internal, members: users.filter(x => x.orgId === o.id).length, projects: projects.filter(p => p.owner === o.id).length, owner: (users.find(x => x.orgId === o.id && x.role === 'owner') || {}).email || '', mrr, created: o.created }; });
    return { orgs: rows.sort((a, b) => b.created - a.created), totals: { orgs: rows.length, users: users.length, paying: rows.filter(r => r.mrr > 0).length, trials: rows.filter(r => r.trial).length, mrr: rows.reduce((a, r) => a + r.mrr, 0) } };
  },
  async adminInviteCustomer({ email, org, plan }) {
    const { u } = await this.need(); if (!u.superadmin) err('Nur für Plattform-Admins.'); email = (email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) err('Bitte eine gültige E-Mail angeben.'); if (await DB.get('users', email)) err('Diese E-Mail hat schon ein Konto.');
    const o = await this.saveOrg({ type: 'org', id: rid(), name: org || '', plan: PLANS[plan] ? plan : 'pro', trialEnds: Date.now() + TRIAL_DAYS * 864e5, paid: false, addons: {}, usage: {}, invites: [{ email, role: 'owner', token: rid(), at: Date.now() }], integrations: {}, created: Date.now() });
    return { ok: true, link: null, org: o.id };
  },
  async adminSetPlan(orgId, plan) { const { u } = await this.need(); if (!u.superadmin) err('Nur für Plattform-Admins.'); const o = await this.org(orgId); if (!o || !PLANS[plan]) err('Unbekannt.'); Object.assign(o, { plan, paid: plan !== 'free', trialEnds: null }); await this.saveOrg(o); return this.adminOverview(); },
  async publish() { err('Veröffentlichen braucht den Server-Modus (Konto → Backend).'); },
  async render() { err('Datei-Export braucht den Server-Modus (Konto → Backend).'); },
  async stats() { return null; },
};

// ---------- remote backend ----------
const remote = {
  base() { return (cfg().base || '').replace(/\/$/, ''); },
  async req(path, opt = {}) {
    const isForm = opt.body instanceof FormData, h = opt.body && !isForm ? { 'Content-Type': 'application/json' } : {}, t = localStorage.getItem(TOK_KEY);
    if (t) h.Authorization = 'Bearer ' + t;
    const r = await fetch(this.base() + path, { ...opt, headers: h, body: opt.body && !isForm ? JSON.stringify(opt.body) : opt.body });
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if (!r.ok) throw new Error((j && j.error) || 'Serverfehler ' + r.status); return j;
  },
  async register(b) { const inv = new URLSearchParams(location.search).get('invite'); const j = await this.req('/api/auth/register', { method: 'POST', body: { ...b, invite: inv } }); localStorage.setItem(TOK_KEY, j.token); return j.user; },
  async login(b) { const j = await this.req('/api/auth/login', { method: 'POST', body: b }); localStorage.setItem(TOK_KEY, j.token); return j.user; },
  async me() { if (!localStorage.getItem(TOK_KEY)) return null; try { return (await this.req('/api/auth/me')).user; } catch (e) { return null; } },
  async logout() { try { await this.req('/api/auth/logout', { method: 'POST' }); } catch (e) {} localStorage.removeItem(TOK_KEY); },
  async changePassword(b) { await this.req('/api/auth/password', { method: 'POST', body: b }); return true; },
  async requestReset(email) { await this.req('/api/auth/reset-request', { method: 'POST', body: { email } }); return true; },
  async resetPassword(token, password) { const j = await this.req('/api/auth/reset', { method: 'POST', body: { token, password } }); localStorage.setItem(TOK_KEY, j.token); return j.user; },
  async updateMe(b) { return (await this.req('/api/auth/me', { method: 'PATCH', body: b })).user; },
  async listProjects() { return (await this.req('/api/projects')).projects; },
  async saveProject(p) { await this.req('/api/projects/' + p.id, { method: 'PUT', body: { data: p } }); },
  async deleteProject(id) { await this.req('/api/projects/' + id, { method: 'DELETE' }); },
  async putMedia(id, blob, projectId) { const f = new FormData(); f.append('file', blob, blob.name || id); f.append('id', id); f.append('project', projectId || ''); return (await this.req('/api/media', { method: 'POST', body: f })).url; },
  async getMedia() { return null; },
  async delMedia(id) { try { await this.req('/api/media/' + id, { method: 'DELETE' }); } catch (e) {} },
  async integrations() { return (await this.req('/api/integrations')).integrations; },
  async connect(platform) {
    const { url } = await this.req('/api/integrations/' + platform + '/start', { method: 'POST' });
    const w = window.open(url, 'oauth', 'width=560,height=720');
    for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 1000)); const all = await this.integrations(); if (all[platform]) { w && w.close(); return all; } if (w && w.closed) break; }
    throw new Error('Verbindung abgebrochen.');
  },
  async disconnect(platform) { return (await this.req('/api/integrations/' + platform, { method: 'DELETE' })).integrations; },
  async useCredit(kind = 'ki', n = 1) { return (await this.req('/api/usage', { method: 'POST', body: { kind, n } })).remaining; },
  async team() { return this.req('/api/team'); },
  async invite(b) { return (await this.req('/api/team/invites', { method: 'POST', body: b })).invites; },
  async revokeInvite(email) { return (await this.req('/api/team/invites/' + encodeURIComponent(email), { method: 'DELETE' })).invites; },
  async setRole(userId, role) { return this.req('/api/team/members/' + userId, { method: 'PATCH', body: { role } }); },
  async removeMember(userId) { return this.req('/api/team/members/' + userId, { method: 'DELETE' }); },
  async subscribe(plan, cycle) { const j = await this.req('/api/billing/checkout', { method: 'POST', body: { plan, cycle, returnUrl: location.href.split('?')[0] } }); if (j.url) location.href = j.url; return j; },
  async buyAddon(key) { const j = await this.req('/api/billing/addon', { method: 'POST', body: { key, returnUrl: location.href.split('?')[0] } }); if (j.url) location.href = j.url; return j; },
  async invoices() { return (await this.req('/api/billing/invoices')).invoices; },
  async portal() { const j = await this.req('/api/billing/portal', { method: 'POST', body: { returnUrl: location.href.split('?')[0] } }); if (j.url) location.href = j.url; },
  async adminOverview() { return this.req('/api/admin/overview'); },
  async adminInviteCustomer(b) { return this.req('/api/admin/invite-customer', { method: 'POST', body: b }); },
  async adminSetPlan(orgId, plan) { await this.req('/api/admin/orgs/' + orgId, { method: 'PATCH', body: { plan } }); return this.adminOverview(); },
  async publish(b) { return (await this.req('/api/publish', { method: 'POST', body: b })).publication; },
  async render(b) { return (await this.req('/api/render', { method: 'POST', body: b })).job; },
  async job(id) { return (await this.req('/api/render/' + id)).job; },
  async stats(pubId) { return (await this.req('/api/publications/' + pubId + '/stats')).stats; },
};

const impl = () => (cfg().mode === 'remote' && cfg().base ? remote : local);
const api = {};
['register', 'login', 'me', 'logout', 'requestReset', 'resetPassword', 'changePassword', 'updateMe', 'listProjects', 'saveProject', 'deleteProject', 'putMedia', 'getMedia', 'delMedia', 'integrations', 'connect', 'disconnect', 'useCredit',
 'team', 'invite', 'revokeInvite', 'setRole', 'removeMember', 'subscribe', 'buyAddon', 'invoices', 'portal', 'adminOverview', 'adminInviteCustomer', 'adminSetPlan', 'publish', 'render', 'stats'].forEach(k => { api[k] = (...a) => impl()[k](...a); });
api.job = id => remote.job(id);
api.config = () => ({ mode: 'local', base: '', ...cfg() });
api.setConfig = c => { localStorage.setItem(CFG_KEY, JSON.stringify({ ...cfg(), ...c })); };
api.isRemote = () => impl() === remote;
api.registration = async () => { if (!api.isRemote()) return 'open'; try { return (await api.ping(api.config().base)).registration || 'open'; } catch (e) { return 'open'; } };
api.ping = async base => { const r = await fetch(base.replace(/\/$/, '') + '/api/health'); if (!r.ok) throw new Error('Server antwortet nicht'); return r.json(); };
Object.assign(api, { visible, PLATFORMS, EXPORTS, PLANS, ADDONS, ROLES, ROLE_INFO, PERMS, TRIAL_DAYS, can, INF });
window.ASApi = api;
})();
