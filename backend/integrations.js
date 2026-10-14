// OAuth + Publishing + Stats für Instagram (Meta Graph API), TikTok (Content Posting API) und YouTube (Data API v3).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { db, enc, dec } from './db.js';

const PUB = () => process.env.PUBLIC_URL;
const cb = p => `${PUB()}/oauth/${p}/callback`;
const G = 'https://graph.facebook.com/v21.0';
const j = async r => { const x = await r.json(); if (!r.ok || x.error) throw new Error(x.error?.message || x.error_description || x.error?.code || JSON.stringify(x)); return x; };
const form = o => new URLSearchParams(o);

export const providers = {
  instagram: {
    authUrl: state => `https://www.facebook.com/v21.0/dialog/oauth?` + form({ client_id: process.env.META_APP_ID, redirect_uri: cb('instagram'), state, scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement,business_management' }),
    async exchange(code) {
      const t = await j(await fetch(`${G}/oauth/access_token?` + form({ client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: cb('instagram'), code })));
      const ll = await j(await fetch(`${G}/oauth/access_token?` + form({ grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, fb_exchange_token: t.access_token })));
      const pages = await j(await fetch(`${G}/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${ll.access_token}`));
      const pg = (pages.data || []).find(p => p.instagram_business_account); if (!pg) throw new Error('Kein Instagram-Business-Konto mit einer Facebook-Seite verknüpft.');
      return { token: ll.access_token, expires: Date.now() + (ll.expires_in || 5184000) * 1000, account: '@' + pg.instagram_business_account.username, account_id: pg.instagram_business_account.id };
    },
    async publish(it, { videoUrl, caption, isImage }) {
      const c = await j(await fetch(`${G}/${it.account_id}/media`, { method: 'POST', body: form(isImage ? { image_url: videoUrl, caption, access_token: it.token } : { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: it.token }) }));
      for (let i = 0; i < 60; i++) { const s = await j(await fetch(`${G}/${c.id}?fields=status_code&access_token=${it.token}`)); if (s.status_code === 'FINISHED') break; if (s.status_code === 'ERROR') throw new Error('Instagram-Verarbeitung fehlgeschlagen'); await new Promise(r => setTimeout(r, 5000)); }
      const p = await j(await fetch(`${G}/${it.account_id}/media_publish`, { method: 'POST', body: form({ creation_id: c.id, access_token: it.token }) }));
      const m = await j(await fetch(`${G}/${p.id}?fields=permalink&access_token=${it.token}`));
      return { remote_id: p.id, url: m.permalink };
    },
    async stats(it, remoteId) {
      const x = await j(await fetch(`${G}/${remoteId}/insights?metric=views,likes,shares,comments&access_token=${it.token}`));
      const v = k => (x.data.find(d => d.name === k)?.values?.[0]?.value) ?? 0;
      return { views: v('views'), likes: v('likes'), shares: v('shares'), comments: v('comments') };
    },
  },
  tiktok: {
    pkce: true,
    authUrl: (state, challenge) => `https://www.tiktok.com/v2/auth/authorize/?` + form({ client_key: process.env.TIKTOK_CLIENT_KEY, redirect_uri: cb('tiktok'), state, response_type: 'code', scope: 'user.info.basic,video.publish,video.list', code_challenge: challenge, code_challenge_method: 'S256' }),
    async exchange(code, verifier) {
      const t = await j(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: cb('tiktok'), code_verifier: verifier }) }));
      const u = await j(await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', { headers: { Authorization: 'Bearer ' + t.access_token } }));
      return { token: t.access_token, refresh: t.refresh_token, expires: Date.now() + t.expires_in * 1000, account: u.data.user.display_name, account_id: t.open_id };
    },
    async refresh(it) {
      const t = await j(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: it.refresh }) }));
      return { token: t.access_token, refresh: t.refresh_token, expires: Date.now() + t.expires_in * 1000 };
    },
    async publish(it, { videoUrl, caption }) {
      // PULL_FROM_URL verlangt eine in TikTok verifizierte Domain für PUBLIC_URL.
      const H = { Authorization: 'Bearer ' + it.token, 'Content-Type': 'application/json; charset=UTF-8' };
      const r = await j(await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', { method: 'POST', headers: H, body: JSON.stringify({ post_info: { title: caption.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' }, source_info: { source: 'PULL_FROM_URL', video_url: videoUrl } }) }));
      let vid = null;
      for (let i = 0; i < 60; i++) { const s = await j(await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', { method: 'POST', headers: H, body: JSON.stringify({ publish_id: r.data.publish_id }) })); if (s.data.status === 'PUBLISH_COMPLETE') { vid = (s.data.publicaly_available_post_id || [])[0]; break; } if (s.data.status === 'FAILED') throw new Error('TikTok: ' + s.data.fail_reason); await new Promise(x => setTimeout(x, 5000)); }
      return { remote_id: vid ? String(vid) : r.data.publish_id, url: vid ? `https://www.tiktok.com/@${it.account}/video/${vid}` : null };
    },
    async stats(it, remoteId) {
      const x = await j(await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,share_count,comment_count', { method: 'POST', headers: { Authorization: 'Bearer ' + it.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: { video_ids: [remoteId] } }) }));
      const v = x.data.videos[0] || {}; return { views: v.view_count || 0, likes: v.like_count || 0, shares: v.share_count || 0, comments: v.comment_count || 0 };
    },
  },
  youtube: {
    authUrl: state => `https://accounts.google.com/o/oauth2/v2/auth?` + form({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: cb('youtube'), response_type: 'code', access_type: 'offline', prompt: 'consent', state, scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly' }),
    async exchange(code) {
      const t = await j(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: cb('youtube'), grant_type: 'authorization_code' }) }));
      const ch = await j(await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: 'Bearer ' + t.access_token } }));
      const c = ch.items?.[0]; return { token: t.access_token, refresh: t.refresh_token, expires: Date.now() + t.expires_in * 1000, account: c?.snippet?.title || 'YouTube', account_id: c?.id };
    },
    async refresh(it) {
      const t = await j(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: it.refresh, grant_type: 'refresh_token' }) }));
      return { token: t.access_token, refresh: it.refresh, expires: Date.now() + t.expires_in * 1000 };
    },
    async publish(it, { filePath, caption, title }) {
      const meta = { snippet: { title: (title || caption).slice(0, 100), description: caption, categoryId: '24' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } };
      const size = fs.statSync(filePath).size;
      const s = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST', headers: { Authorization: 'Bearer ' + it.token, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) }, body: JSON.stringify(meta) });
      if (!s.ok) throw new Error('YouTube-Upload konnte nicht starten: ' + (await s.text()));
      const v = await j(await fetch(s.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.createReadStream(filePath), duplex: 'half' }));
      return { remote_id: v.id, url: 'https://youtu.be/' + v.id };
    },
    async stats(it, remoteId) {
      const x = await j(await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${remoteId}`, { headers: { Authorization: 'Bearer ' + it.token } }));
      const s = x.items?.[0]?.statistics || {}; return { views: +s.viewCount || 0, likes: +s.likeCount || 0, shares: 0, comments: +s.commentCount || 0 };
    },
  },
};

export function startOAuth(orgId, platform) {
  const P = providers[platform]; if (!P) throw new Error('Unbekannte Plattform');
  const state = crypto.randomBytes(16).toString('hex'), verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  db.prepare('INSERT INTO oauth_states VALUES (?,?,?,?,?)').run(state, orgId, platform, verifier, Date.now());
  return P.authUrl(state, challenge);
}
export async function finishOAuth(platform, code, state) {
  const st = db.prepare('SELECT * FROM oauth_states WHERE state=? AND platform=?').get(state, platform);
  if (!st || Date.now() - st.created > 15 * 60e3) throw new Error('OAuth-Status ungültig oder abgelaufen');
  db.prepare('DELETE FROM oauth_states WHERE state=?').run(state);
  const r = await providers[platform].exchange(code, st.verifier);
  db.prepare('INSERT OR REPLACE INTO integrations VALUES (?,?,?,?,?,?,?,?)').run(st.org_id, platform, r.account, r.account_id, enc(r.token), enc(r.refresh), r.expires, Date.now());
}
export async function getIntegration(orgId, platform) {
  const row = db.prepare('SELECT * FROM integrations WHERE org_id=? AND platform=?').get(orgId, platform); if (!row) return null;
  let it = { ...row, token: dec(row.token), refresh: dec(row.refresh) };
  if (it.expires && it.expires < Date.now() + 60e3 && providers[platform].refresh && it.refresh) {
    const n = await providers[platform].refresh(it); it = { ...it, ...n };
    db.prepare('UPDATE integrations SET token=?, refresh=?, expires=? WHERE org_id=? AND platform=?').run(enc(n.token), enc(n.refresh), n.expires, orgId, platform);
  }
  return it;
}
