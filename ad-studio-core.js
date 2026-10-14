// Ad Studio — shared data, templates, ad builder, audio engine, file store
(function () {
const FORMATS = [
  { id: 'reel', label: 'Reel', net: 'Instagram · Facebook', ch: 'meta', w: 1080, h: 1920, kind: 'video', ratio: '9:16', safe: [14, 20], rec: [6, 30] },
  { id: 'story', label: 'Story', net: 'Instagram · Facebook', ch: 'meta', w: 1080, h: 1920, kind: 'video', ratio: '9:16', safe: [12, 18], rec: [5, 15] },
  { id: 'feed45', label: 'Feed 4:5', net: 'Instagram · Facebook', ch: 'meta', w: 1080, h: 1350, kind: 'image', ratio: '4:5' },
  { id: 'feed11', label: 'Feed 1:1', net: 'Facebook · Instagram', ch: 'meta', w: 1080, h: 1080, kind: 'image', ratio: '1:1' },
  { id: 'link', label: 'Link-Ad', net: 'Facebook', ch: 'meta', w: 1200, h: 628, kind: 'image', ratio: '1.91:1' },
  { id: 'tiktok', label: 'TikTok In-Feed', net: 'TikTok', ch: 'tiktok', w: 1080, h: 1920, kind: 'video', ratio: '9:16', safe: [10, 24], rec: [9, 34] },
  { id: 'shorts', label: 'YouTube Shorts', net: 'YouTube', ch: 'youtube', w: 1080, h: 1920, kind: 'video', ratio: '9:16', safe: [10, 22], rec: [6, 60] },
  { id: 'yt', label: 'In-Stream 16:9', net: 'YouTube', ch: 'youtube', w: 1920, h: 1080, kind: 'video', ratio: '16:9', safe: [0, 14], rec: [6, 30] },
  { id: 'pin', label: 'Pinterest Pin', net: 'Pinterest', ch: 'pinterest', w: 1000, h: 1500, kind: 'image', ratio: '2:3' },
  { id: 'mr', label: 'Medium Rectangle', net: 'Google Display', ch: 'display', w: 300, h: 250, kind: 'image', ratio: '300×250' },
  { id: 'bb', label: 'Billboard', net: 'Google Display', ch: 'display', w: 970, h: 250, kind: 'image', ratio: '970×250' },
];
const CHANNELS = [['all', 'Alle'], ['meta', 'Meta'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['pinterest', 'Pinterest'], ['display', 'Display']];
const TR = { cut: ['Schnitt', 0, null, 'hart'], flash: ['Blitz', 0.34, 'impact', '+ Hit'], whipR: ['Whip →', 0.22, 'whoosh', '+ Whoosh'], whipL: ['Whip ←', 0.22, 'whoosh', '+ Whoosh'], xfade: ['Blende', 0.5, null, 'weich'], zoom: ['Zoom-Punch', 0.3, 'impact', '+ Hit'], wipe: ['Wisch', 0.6, 'whoosh', '+ Whoosh'], glitch: ['Glitch', 0.3, 'tick', '+ Klick'], dip: ['Schwarz', 0.5, null, 'Abblende'] };
const TR_COLOR = { cut: '#c9c7d6', flash: '#ffffff', whipR: '#5ee0c8', whipL: '#5ee0c8', xfade: '#a9a6bd', zoom: '#ff7a6b', wipe: '#ffc65c', glitch: '#d58cff', dip: '#7d7a90' };
const FXDEF = { whoosh: ['Whoosh', '#5ee0c8', 0.4, 0.28, 0.4], impact: ['Hit', '#ff7a6b', 0.4, 0, 0.6], riser: ['Riser', '#ffc65c', 0.9, 0.9, 0.2], stamp: ['Stempel', '#d58cff', 0.25, 0, 0.55], beep: ['REC-Piep', '#8fb3ff', 0.25, 0, 0.1], tick: ['Klick', '#c9c7d6', 0.06, 0, 0.1], pop: ['Pop', '#a6e87a', 0.15, 0, 0.18] };
const ANIMS = [['pop', 'Pop'], ['type', 'Schreibmaschine'], ['slide', 'Slide-up'], ['fade', 'Fade'], ['stamp', 'Stempel'], ['none', 'Ohne']];
const FONTS = { 'VT323': ["'VT323',monospace", 400], 'Jost': ["'Jost',sans-serif", 600], 'Bricolage Grotesque': ["'Bricolage Grotesque',sans-serif", 700], 'Anton': ["'Anton',sans-serif", 400], 'DM Serif Display': ["'DM Serif Display',serif", 400], 'Space Mono': ["'Space Mono',monospace", 700], 'Archivo Black': ["'Archivo Black',sans-serif", 400], 'Playfair Display': ["'Playfair Display',serif", 700] };
const PALETTES = [
  ['Sommerrausch', '#d2161b', '#2b2a29', '#ede6d8'], ['Neon Night', '#ff3d81', '#14121f', '#f4f0ff'], ['Electric', '#4f46e5', '#0f172a', '#f8fafc'],
  ['Forest Fest', '#1f8a5b', '#13241c', '#f1efe4'], ['Sunset', '#ff7a1a', '#2a1630', '#fff3e6'], ['Acid', '#d4f53c', '#111111', '#f5f5f0'],
];
const STATUS = { draft: ['Entwurf', '#eeedf3', '#4a4858'], review: ['In Review', '#fff1d6', '#8a5a00'], approved: ['Freigegeben', '#dcf5ea', '#0f6e47'] };
const MEDIA_CATS = ['Sequenz', 'Highlight', 'Crowd', 'Bühne', 'Act', 'Location', 'Backstage', 'Detail', 'Logo', 'Key Visual', 'Musik', 'Voiceover'];
const EVENT_TYPES = ['Konzert', 'Festival', 'Club', 'Theater', 'Comedy', 'Konferenz', 'Ausstellung', 'Messe', 'Sport', 'Party', 'Lesung'];
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const PHASE_TPL = {
  geschenk: { label: 'Geschenk', time: 'Okt–Dez', len: 15, c: { hookA: 'UNTERM WEIHNACHTSBAUM.', hookB: 'TICKETS FÜR {year}.', live: 'DAS GESCHENK: {act!} LIVE.', cta: 'DAS GESCHENK FÜR {year}.', button: 'TICKETS VERSCHENKEN >>', sticker: 'VERSCHENKEN\n{dateShort}',
    primary: 'Noch kein Geschenk? 🎁 Verschenk einen unvergesslichen Abend: {act} live in {city}.\n{weekday}, {date} · {time} Uhr · {venue}\n🎟️ Tickets jetzt verschenken.', headline: '{act} live – das Geschenk', desc: '{date} · {venue}' } },
  ankuendigung: { label: 'Ankündigung', time: 'Start', len: 22, c: { hookA: '{year}.', hookB: '{act!} KOMMT.', live: 'LIVE IN {city!}.', cta: 'POV: DU BIST DABEI.', button: 'TICKETS SICHERN >>', sticker: '{weekday!}\n{time} UHR',
    primary: 'Es ist offiziell: {act} kommt nach {city}! 🎤\n📍 {venue}\n🗓️ {weekday}, {date} · {time} Uhr\n🎟️ Sichere dir jetzt deine Tickets.', headline: '{act} live in {city}', desc: '{date} · {time} Uhr · {venue}' } },
  vorverkauf: { label: 'Vorverkauf', time: 'laufend', len: 15, c: { hookA: 'POV: {weekday!}ABEND.', hookB: 'DU MITTENDRIN.', live: '{act!} LIVE.', cta: 'TICKETS JETZT SICHERN.', button: 'TICKETS SICHERN >>', sticker: '{dateShort}\n{city!}',
    primary: 'POV: {weekday}abend, {venue} – und du bist mittendrin. 🎶\n{act} live in {city}.\n🗓️ {date} · {time} Uhr\n🎟️ Tickets sichern.', headline: '{act} · {date}', desc: '{venue}, {city}' } },
  knappheit: { label: 'Knappheit', time: '4–6 Wochen vorher', len: 15, c: { hookA: '{weekday!}, {time} UHR.', hookB: 'DU IM PUBLIKUM?', live: 'SEI DABEI.', cta: 'NUR NOCH WENIGE TICKETS.', button: 'TICKETS SICHERN >>', sticker: 'WENIGE\nTICKETS',
    primary: 'Alle sind dabei – und du? 👀\nFür {act} am {date} in {city} gibt es nur noch wenige Tickets.\n🎟️ Jetzt sichern.', headline: 'Nur noch wenige Tickets', desc: '{act} · {date} · {city}' } },
  lastcall: { label: 'Last Call', time: 'letzte 14 Tage', len: 12, c: { hookA: 'NOCH 14 TAGE.', hookB: 'DANN IST ES SOWEIT.', live: 'LETZTE CHANCE.', cta: 'LAST CALL · LETZTE TICKETS', button: 'JETZT ODER NIE >>', sticker: 'LAST CALL\n{dateShort}',
    primary: 'Last Call! ⏳ {act} live – {weekday}, {date} · {time} Uhr, {venue}.\n🎟️ Hol dir die letzten Tickets.', headline: 'Last Call: {act} live', desc: '{weekday} · {date} · {time} Uhr' } },
};
const CAMPAIGNS = { standard: ['Ticketing · 4 Phasen', ['ankuendigung', 'vorverkauf', 'knappheit', 'lastcall']], geschenk: ['Mit Weihnachtsgeschäft', ['geschenk', 'ankuendigung', 'knappheit', 'lastcall']], kurz: ['Kurzkampagne · 2 Phasen', ['vorverkauf', 'lastcall']] };
const COPY_FIELDS = [['hookA', 'Hook Zeile 1'], ['hookB', 'Hook Zeile 2'], ['live', 'Live-Caption'], ['sticker', 'Sticker'], ['cta', 'CTA-Headline'], ['button', 'Button'], ['primary', 'Primärtext'], ['headline', 'Überschrift'], ['desc', 'Beschreibung']];

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const starts = clips => { const o = []; let a = 0; clips.forEach(c => { o.push(a); a += c.dur; }); return o; };

function eventCtx(p) {
  const d = p.date ? new Date(p.date + 'T12:00') : null, valid = d && !isNaN(d);
  const wd = valid ? WD[d.getDay()] : '', date = valid ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  return { name: p.name || '', act: p.act || p.name || '', venue: p.venue || '', city: p.city || '', time: p.time || '', date, dateShort: date.slice(0, 6), year: valid ? d.getFullYear() : '', weekday: wd };
}
function fill(str, ctx) { return String(str || '').replace(/\{(\w+)(!)?\}/g, (m, k, up) => { const v = String(ctx[k] ?? ''); return up ? v.toUpperCase() : v; }); }
function phaseFromTpl(tplId, p) {
  const T = PHASE_TPL[tplId], ctx = eventCtx(p), c = {};
  Object.keys(T.c).forEach(k => { c[k] = fill(T.c[k], ctx); });
  return { id: tplId + '-' + uid().slice(0, 4), tpl: tplId, label: T.label, time: T.time, len: T.len, c };
}
function fmtById(id) { return FORMATS.find(f => f.id === id) || FORMATS[0]; }

function buildAd(p, phId, fId, ki) {
  const P = p.phases.find(x => x.id === phId) || p.phases[0] || { c: {}, len: 15 }, F = fmtById(fId), c = P.c || {};
  const copy = { primary: c.primary || '', headline: c.headline || '', desc: c.desc || '', cta: 'Tickets kaufen', url: p.url || '' };
  const T = o => ({ id: uid(), font: 'display', anchor: 'left', rot: 0, start: 0, end: 999, anim: 'none', ...o });
  const imgs = p.media.filter(m => m.kind === 'image' && !m.logo), ar = F.w / F.h;
  let img = null, bd = 99; imgs.forEach(m => { const d = Math.abs(Math.log((m.ar || 1) / ar)); if (d < bd) { bd = d; img = m; } });
  if (F.kind === 'image') {
    const wide = ar > 1.3, xwide = ar > 3, texts = [];
    if (c.sticker) texts.push(T({ role: 'sticker', text: c.sticker, x: wide ? (xwide ? 78 : 64) : 30, y: wide ? 14 : 17, size: wide ? (xwide ? 12 : 7) : 3.8, style: 'sticker', font: 'text' }));
    if (!img && c.hookB) texts.push(T({ role: 'hookB', text: c.hookB, x: 6, y: 40, size: wide ? 12 : 8, style: 'primary' }));
    if (wide || !img) texts.push(T({ role: 'button', text: c.button || 'TICKETS >>', x: 50, y: xwide ? 62 : 80, size: F.id === 'mr' ? 8 : xwide ? 14 : 6, style: 'ink', anchor: 'center' }));
    return { bg: img ? 'm:' + img.id : null, clips: [], texts, sfx: [], audio: [], copy, status: 'draft' };
  }
  const len = (ki && ki.len) || P.len || 15, style = (ki && ki.style) || 'energie', vert = F.h > F.w;
  const C = p.media.filter(m => m.kind === 'clip' && !m.noAuto), seq = [], idx = {};
  const add = (m, d, tr, tag) => { if (tag) idx[tag] = seq.length; seq.push([m, d, tr]); };
  if (C[0]) add(C[0], 3, 'cut', 'hook');
  if (C[1]) add(C[1], 1.9, 'whipR', 'live');
  if (C[2]) add(C[2], 1.6, 'whipL');
  if (img && C.length) add(img, 3, 'flash', 'reveal');
  const rest = C.slice(3, 7); rest.forEach((m, i) => add(m, i === rest.length - 1 ? 1.2 : 1, i === 0 ? 'flash' : (i % 2 ? 'whipR' : 'whipL'), i === 0 ? 'songs' : null));
  if (img) add(img, C.length ? 4 : len * 0.45, C.length ? 'flash' : 'cut', 'end');
  else if (C[0]) add(C[0], 3, 'flash', 'end');
  if (!C.length && img) { seq.unshift([img, len * 0.55, 'cut']); Object.keys(idx).forEach(k => idx[k]++); idx.hook = 0; }
  const map = style === 'atmo' ? { whipR: 'xfade', whipL: 'xfade', flash: 'wipe' } : style === 'clean' ? { whipR: 'cut', whipL: 'cut', flash: 'dip' } : {};
  const sum = seq.reduce((a, s) => a + s[1], 0) || 1, k = len / sum;
  const clips = seq.map(([m, d, tr], i) => ({ id: uid(), asset: 'm:' + m.id, dur: +(d * k).toFixed(2), speed: m.kind === 'clip' ? 'auto' : '1', trans: i ? (map[tr] || tr) : 'cut', link: true }));
  const st = starts(clips), TT = clips.length ? st[st.length - 1] + clips[clips.length - 1].dur : len;
  const at = (tag, frac) => idx[tag] != null ? st[idx[tag]] : frac * TT;
  const hookEnd = clips.length > 1 ? st[1] : TT * 0.3, revealS = at('reveal', 0.4), songsS = idx.songs != null ? st[idx.songs] : null, endS = at('end', 0.72);
  const X = vert ? 9 : 6, texts = [];
  texts.push(T({ role: 'pov', text: 'POV:', x: X, y: vert ? 27 : 16, size: vert ? 26 : 22, style: 'white', start: 0.15, end: hookEnd, anim: 'type' }));
  if (c.hookA) texts.push(T({ role: 'hookA', text: c.hookA, x: X, y: vert ? 44 : 46, size: 8.5, style: 'ink', start: 0.7, end: hookEnd, anim: 'pop' }));
  if (c.hookB) texts.push(T({ role: 'hookB', text: c.hookB, x: X, y: vert ? 50 : 58, size: 8.5, style: 'primary', start: 1.15, end: hookEnd, anim: 'pop' }));
  if (c.live && revealS - hookEnd > 0.8) texts.push(T({ role: 'live', text: c.live, x: X - 1, y: vert ? 47 : 50, size: 7.6, style: 'paper', start: hookEnd + 0.3, end: revealS, anim: 'pop', rot: -1.5 }));
  if (c.sticker) texts.push(T({ role: 'sticker', text: c.sticker, x: vert ? 66 : 72, y: vert ? 58 : 60, size: 4.2, style: 'sticker', font: 'text', start: revealS + 1.2, end: songsS ?? endS, anim: 'stamp' }));
  const hl = (p.highlights || []).slice(0, 3);
  if (songsS != null && hl.length) {
    if (p.highlightIntro) texts.push(T({ role: 'song0', text: p.highlightIntro, x: X - 1, y: vert ? 34 : 14, size: 6, style: 'ink', start: songsS + 0.15, end: endS, anim: 'pop', rot: -1.5 }));
    hl.forEach((h, i) => { const ci = idx.songs + 1 + i, s0 = ci < clips.length - 1 ? st[ci] : songsS + (i + 1) * (endS - songsS) / 4;
      texts.push(T({ role: 'song' + (i + 1), text: h, x: X - 1, y: vert ? 40 + i * 8 : 30 + i * 18, size: 11.5, style: i === hl.length - 1 ? 'primary' : 'ink', start: s0, end: endS, anim: 'pop', rot: i % 2 ? -1.5 : 1.5 })); });
  }
  if (c.cta) texts.push(T({ role: 'cta', text: c.cta, x: 50, y: vert ? 6 : 7, size: 7.8, style: 'primary', anchor: 'center', start: endS + 0.2, end: TT, anim: 'pop', rot: -1.5 }));
  texts.push(T({ role: 'button', text: c.button || 'TICKETS SICHERN >>', x: 50, y: vert ? 84 : 82, size: 6.6, style: 'ink', anchor: 'center', start: endS + 0.5, end: TT, anim: 'pop' }));
  const S = (fx, t0) => ({ id: uid(), fx, at: +Math.max(0, t0).toFixed(2) });
  const sfx = [S('beep', 0.05), S('tick', 0.7), S('tick', 1.15), S('pop', endS + 0.6)];
  if (idx.reveal != null) sfx.push(S('riser', revealS), S('stamp', revealS + 1.25));
  if (songsS != null) sfx.push(S('tick', songsS + 0.15));
  const mus = p.media.find(m => m.kind === 'audio' && m.music) || p.media.find(m => m.kind === 'audio');
  const audio = mus ? [{ id: 'music', media: mus.id, kind: 'Musik', label: mus.label, offset: p.musicOffset || 0, at: 0, len: null, vol: 0.9, fadeIn: 0.5, fadeOut: 1, introLow: clips.length > 1 }] : [];
  return { clips, texts, sfx, audio, copy, status: 'draft', len };
}

// ---------- persistent file store ----------
const IDB = {
  db: null,
  open() { return this.db || (this.db = new Promise((res, rej) => { const r = indexedDB.open('ad-studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async put(id, blob) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(id) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('files').objectStore('files').get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async del(id) { const db = await this.open(); return new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(id); tx.oncomplete = res; tx.onerror = res; }); },
};

// ---------- audio ----------
const AUD = { ctx: null };
function audioInit() {
  if (AUD.ctx) return AUD.ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC();
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1; lim.connect(ctx.destination);
  const duck = ctx.createGain(); duck.connect(lim);
  const sfx = ctx.createGain(); sfx.gain.value = 0.7; sfx.connect(lim);
  const len = ctx.sampleRate * 2, noise = ctx.createBuffer(1, len, ctx.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  Object.assign(AUD, { ctx, lim, duck, sfx, noise });
  return ctx;
}
function routeEl(el) {
  const ctx = AUD.ctx; if (!ctx || ctx.state !== 'running') return null;
  if (el.__g !== undefined) return el.__g;
  try {
    const src = ctx.createMediaElementSource(el), f = (type, fr, q, g) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fr; if (q) b.Q.value = q; if (g != null) b.gain.value = g; return b; };
    const hp = f('highpass', 32, 0.7), mud = f('peaking', 320, 0.9, -2.5), pres = f('peaking', 3200, 0.8, 1.5), air = f('highshelf', 10000, 0, 2);
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.02; glue.release.value = 0.25;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(mud); mud.connect(pres); pres.connect(air); air.connect(glue); glue.connect(g); g.connect(AUD.duck);
    el.__g = g; return g;
  } catch (e) { el.__g = null; return null; }
}
function playFx(fx, o, bus) {
  const ctx = AUD.ctx; if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime, out = AUD.sfx; out.gain.setTargetAtTime(bus, t, 0.02);
  const G = () => ctx.createGain(), env = (g, t0, a, pk, d) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
  const nz = dur => { const s = ctx.createBufferSource(); s.buffer = AUD.noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; };
  const flt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const osc = (f0, f1, dur, t0 = t) => { const o2 = ctx.createOscillator(); o2.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o2.frequency.exponentialRampToValueAtTime(f1, t0 + dur); o2.start(t0); o2.stop(t0 + dur + 0.05); return o2; };
  const ch = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); };
  const duck = dp => { AUD.duck.gain.cancelScheduledValues(t); AUD.duck.gain.setTargetAtTime(dp, t, 0.01); AUD.duck.gain.setTargetAtTime(1, t + 0.12, 0.22); };
  const v = o.v;
  if (fx === 'whoosh') {
    const d = o.dur, pk = d * 0.7, bp = flt('bandpass', 350, 1.3), g = G();
    bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(3400, t + pk); bp.frequency.exponentialRampToValueAtTime(900, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + pk); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let last = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(), dir = o.dir || 1; p.pan.setValueAtTime(-0.6 * dir, t); p.pan.linearRampToValueAtTime(0.6 * dir, t + d); g.connect(p); last = p; }
    ch(nz(d), bp, g); last.connect(out);
  } else if (fx === 'impact') {
    const g = G(); env(g, t, 0.004, v, 0.5); ch(osc(120, 40, 0.4), g, out);
    const g2 = G(); env(g2, t, 0.002, v * 0.22, 0.09); ch(nz(0.12), flt('highpass', 1800), g2, out); duck(1 - v * 0.45);
  } else if (fx === 'riser') {
    const d = o.dur, hp = flt('highpass', 200, 2), g = G();
    hp.frequency.setValueAtTime(200, t); hp.frequency.exponentialRampToValueAtTime(5500, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04);
    ch(nz(d + 0.05), hp, g, out);
  } else if (fx === 'stamp') {
    const g = G(); env(g, t, 0.003, v, 0.22); ch(osc(95, 45, 0.22), g, out);
    const g2 = G(); env(g2, t, 0.002, v * 0.4, 0.05); ch(nz(0.08), flt('lowpass', 1300), g2, out); duck(1 - v * 0.35);
  } else if (fx === 'beep') {
    [0, 0.15].forEach(dt => { const g = G(); env(g, t + dt, 0.004, v, 0.07); ch(osc(1950, 1950, 0.09, t + dt), g, out); });
  } else if (fx === 'tick') {
    const g = G(); env(g, t, 0.001, v, 0.03); ch(nz(0.05), flt('highpass', 3800), g, out);
  } else if (fx === 'pop') {
    const g = G(); env(g, t, 0.004, v, 0.13); ch(osc(520, 900, 0.08), g, out);
  }
}

// ---------- seed project ----------
function seedNico() {
  const TR_SRC = 'assets/clips/trailer.mp4';
  const shot = (id, a, b, label, extra) => ({ id, kind: 'clip', label, src: TR_SRC, in: a, len: b - a, ...extra });
  const p = {
    id: 'nico-santos', name: 'Nico Santos · Sommerrausch-Finale', act: 'Nico Santos', type: 'Konzert', date: '2027-06-27', time: '19', venue: 'Seegarten Amorbach', city: 'Amorbach',
    url: 'https://www.reservix.de/tickets-nico-santos-pov-summer-tour-2027-in-amorbach-seegarten-amorbach-am-27-6-2027/e2615592',
    highlights: ['ROOFTOP', 'UNFORGETTABLE', 'LIKE I LOVE YOU'], highlightIntro: 'DIE HITS. LIVE.', musicOffset: 2, created: Date.now(),
    brand: { primary: '#d2161b', ink: '#2b2a29', paper: '#ede6d8', display: 'VT323', text: 'Jost', logo: 'logo' },
    media: [
      shot('swing', 7.8, 9.5, 'Kettenkarussell'), shot('crowd', 12.3, 13.9, 'Crowd singt'), shot('barrier', 14.1, 14.6, 'Absperrung'), shot('selfie', 14.8, 15.5, 'Selfie mit Fans'),
      shot('stage', 16.4, 16.95, 'Bühne'), shot('phones', 17.25, 17.75, 'Handylichter'), shot('smile', 22.4, 24.3, 'Backstage-Lachen'), shot('full', 0, 30, 'Trailer komplett', { noAuto: true }),
      { id: 'poster', kind: 'image', label: 'Plakat 9:16', src: 'assets/ns-story.jpg', ar: 0.5625 }, { id: 'feed', kind: 'image', label: 'Plakat 4:5', src: 'assets/ns-feed.jpg', ar: 0.8 },
      { id: 'land', kind: 'image', label: 'Plakat quer', src: 'assets/ns-landscape.jpg', ar: 1.78 }, { id: 'logo', kind: 'image', label: 'Sommerrausch-Logo', src: 'assets/sr-logo.png', ar: 1, logo: true },
      { id: 'trailerAudio', kind: 'audio', label: 'Rooftop (Trailer-Ton)', src: TR_SRC, len: 30, music: true },
    ],
    links: [['Reel Phase 1 · Geschenk', 'Nico Santos Reel Phase 1 Geschenk 15s.dc.html'], ['Reel Phase 2 · Ankündigung', 'Nico Santos Reel Phase 2 Ankuendigung 22s.dc.html'], ['Reel Phase 4 · Last Call', 'Nico Santos Reel Phase 4 Last Call 12s.dc.html'], ['Meta-Ads-Übersicht', 'Nico Santos Meta Ads.dc.html']],
    phases: [
      { id: 'geschenk', tpl: 'geschenk', label: 'Geschenk', time: 'Okt–Dez', len: 15, c: { hookA: 'UNTERM WEIHNACHTSBAUM.', hookB: 'TICKETS FÜR DEN SOMMER.', live: 'DAS GESCHENK: NICO LIVE.', cta: 'DAS GESCHENK FÜR 2027.', button: 'TICKETS VERSCHENKEN >>', sticker: 'VERSCHENKEN\n27.06.2027', primary: 'Noch kein Geschenk? 🎁 Verschenk einen Sommerabend: Nico Santos live im Seegarten Amorbach.\nSonntag, 27.06.2027 · 19 Uhr – das Finale vom Sommerrausch.\n🎟️ Tickets jetzt verschenken.', headline: 'Nico Santos live – das Geschenk', desc: 'So 27.06.2027 · Seegarten Amorbach' } },
      { id: 'ankuendigung', tpl: 'ankuendigung', label: 'Ankündigung', time: 'Jan–Apr', len: 22, c: { hookA: 'SOMMER 2027.', hookB: 'NICO SANTOS KOMMT.', live: 'ER SPIELT DAS FINALE.', cta: 'POV: DU BIST DABEI.', button: 'TICKETS SICHERN >>', sticker: 'SONNTAG\n19 UHR', primary: 'POV: Sonntagabend, die Sonne geht über dem Seegarten unter – und du singst „Rooftop“ aus voller Kehle mit. 🎤\nNico Santos bringt seine POV: SUMMER TOUR 2027 zum großen Finale vom Sommerrausch nach Amorbach.\n📍 Seegarten Amorbach\n🗓️ Sonntag, 27.06.2027 · 19 Uhr', headline: 'Nico Santos live im Seegarten Amorbach', desc: 'So 27.06.2027 · 19 Uhr · Sommerrausch-Finale' } },
      { id: 'knappheit', tpl: 'knappheit', label: 'Knappheit', time: 'Mai–Jun', len: 15, c: { hookA: 'SONNTAG, 19 UHR.', hookB: 'DU IM SEEGARTEN.', live: 'ER KOMMT NACH AMORBACH.', cta: 'NUR NOCH WENIGE TICKETS.', button: 'TICKETS SICHERN >>', sticker: 'WENIGE\nTICKETS', primary: 'Alle singen „Rooftop“ – und du stehst draußen? 👀\nFür Nico Santos im Seegarten Amorbach gibt es nur noch wenige Tickets.\nSo 27.06.2027 · 19 Uhr\n🎟️ Jetzt sichern.', headline: 'Nur noch wenige Tickets', desc: 'Nico Santos · So 27.06.2027 · Amorbach' } },
      { id: 'lastcall', tpl: 'lastcall', label: 'Last Call', time: 'letzte 14 Tage', len: 12, c: { hookA: 'NOCH 14 TAGE.', hookB: 'DANN IST ES SOWEIT.', live: 'LETZTE CHANCE.', cta: 'LAST CALL · LETZTE TICKETS', button: 'JETZT ODER NIE >>', sticker: 'LAST CALL\n27.06.', primary: 'Der letzte Festivaltag. Der letzte Song. Nico Santos. ⏳\nSonntag, 27.06.2027 · 19 Uhr – das große Finale vom Sommerrausch im Seegarten Amorbach.\n🎟️ Tickets sichern, bevor der Sommer vorbei ist.', headline: 'Last Call: Nico Santos live', desc: 'Sonntag · 27.06.2027 · 19 Uhr' } },
    ],
    ads: {},
  };
  // migrate ads from the first Ad Studio version
  try {
    const old = JSON.parse(localStorage.getItem('ns-ad-studio-v1') || 'null');
    if (old && old.ads) Object.entries(old.ads).forEach(([k, a]) => {
      const mapA = id => id ? id.replace(/^(shot|img):/, 'm:') : id;
      a.clips = (a.clips || []).map(c => ({ ...c, asset: mapA(c.asset) })); a.bg = mapA(a.bg);
      a.texts = (a.texts || []).map(t => ({ ...t, style: t.style === 'red' ? 'primary' : t.style, font: t.font === 'jost' ? 'text' : 'display' }));
      a.audio = (a.audio || []).map(x => ({ ...x, media: x.src === 'trailer' ? 'trailerAudio' : x.src })); a.status = a.done ? 'approved' : 'draft';
      p.ads[k + ':A'] = a;
    });
  } catch (e) {}
  return p;
}

window.ASCore = { FORMATS, CHANNELS, TR, TR_COLOR, FXDEF, ANIMS, FONTS, PALETTES, STATUS, EVENT_TYPES, MEDIA_CATS, PHASE_TPL, CAMPAIGNS, COPY_FIELDS,
  uid, clamp, starts, eventCtx, fill, phaseFromTpl, fmtById, buildAd, IDB, AUD, audioInit, routeEl, playFx, seedNico };
})();
