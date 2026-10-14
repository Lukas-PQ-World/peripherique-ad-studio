// Ad Studio – Medien-Analyse im Browser: Szenen-/Sequenz-Erkennung für Videos, Farbprofil- und Ebenen-Zerlegung für Grafiken.
(function () {
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const once = (el, ev, ms) => new Promise(r => { const t = setTimeout(r, ms); el.addEventListener(ev, () => { clearTimeout(t); r(); }, { once: true }); });
const seek = (v, t) => new Promise(r => { const to = setTimeout(r, 2500); v.onseeked = () => { clearTimeout(to); r(); }; v.currentTime = t; });
const hex = ([r, g, b]) => '#' + [r, g, b].map(x => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
const rgb = h => { const n = parseInt(String(h).replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
function hueName(h, s, l, c) {
  if (c == null) c = s * (1 - Math.abs(2 * l - 1));
  if (l < 0.13) return 'Schwarz';
  if (c >= 0.06 && h >= 15 && h < 70) { if (l < 0.42) return 'Braun'; if (l > 0.8 && c < 0.3) return 'Creme'; }
  if (c < 0.1) return l > 0.85 ? 'Weiß' : l < 0.3 ? 'Schwarz' : 'Grau';
  const n = [[15, 'Rot'], [40, 'Orange'], [65, 'Gelb'], [160, 'Grün'], [195, 'Cyan'], [255, 'Blau'], [290, 'Violett'], [335, 'Magenta'], [360, 'Rot']];
  return n.find(([d]) => h <= d)[1];
}
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return [h, s, l];
}
const colorName = h => { const [r, g, b] = rgb(h), [hh, s, l] = hsl(r, g, b); return hueName(hh, s, l, (Math.max(r, g, b) - Math.min(r, g, b)) / 255); };

// ---------- Video: Szenen & Highlights ----------
async function detectScenes(url, opts = {}, onProgress) {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true; v.src = url;
  await once(v, 'loadeddata', 12000); if (!v.duration || !isFinite(v.duration)) throw new Error('Video konnte nicht gelesen werden.');
  const dur = v.duration, step = opts.step || clamp(dur / 360, 0.12, 0.5), W = 64, H = 36;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  const frames = []; let prevL = null, prevH = null;
  for (let t = 0.02; t < dur - 0.04; t += step) {
    await seek(v, t); x.drawImage(v, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data;
    const L = new Float32Array(W * H), hist = new Float32Array(24); let br = 0, sa = 0, hx = 0, hy = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const r = d[i], g = d[i + 1], b = d[i + 2], l = lum(r, g, b); L[p] = l; br += l;
      hist[r >> 5]++; hist[8 + (g >> 5)]++; hist[16 + (b >> 5)]++;
      const [hh, s] = hsl(r, g, b); sa += s; hx += Math.cos(hh * Math.PI / 180) * s; hy += Math.sin(hh * Math.PI / 180) * s;
    }
    const n = W * H; let diff = 0;
    if (prevL) { let ld = 0, hd = 0; for (let p = 0; p < n; p++) ld += Math.abs(L[p] - prevL[p]); for (let k = 0; k < 24; k++) hd += Math.abs(hist[k] - prevH[k]); diff = 0.5 * clamp(ld / n * 4) + 0.5 * clamp(hd / (n * 6)); }
    frames.push({ t, diff, bright: br / n, sat: sa / n, hx, hy }); prevL = L; prevH = hist;
    onProgress && onProgress(t / dur * 0.85);
  }
  const ds = frames.slice(1).map(f => f.diff).sort((a, b) => a - b), med = ds[Math.floor(ds.length / 2)] || 0.02;
  const sens = clamp(opts.sens ?? 5, 1, 10), thr = Math.max(0.1, med * (9 - sens * 0.7)), minLen = opts.minLen || 0.6;
  const cuts = [0]; frames.forEach(f => { if (f.diff > thr && f.t - cuts[cuts.length - 1] >= minLen) cuts.push(f.t - step / 2); }); cuts.push(dur);
  const stat = (a, b) => { const fs = frames.filter(f => f.t >= a && f.t < b); if (!fs.length) return { motion: 0, bright: 0.5, sat: 0, hue: 0 };
    const m = fs.slice(1).reduce((q, f) => q + f.diff, 0) / Math.max(1, fs.length - 1), hx = fs.reduce((q, f) => q + f.hx, 0), hy = fs.reduce((q, f) => q + f.hy, 0);
    return { motion: m, bright: fs.reduce((q, f) => q + f.bright, 0) / fs.length, sat: fs.reduce((q, f) => q + f.sat, 0) / fs.length, hue: (Math.atan2(hy, hx) * 180 / Math.PI + 360) % 360 }; };
  const maxLen = opts.maxLen || 4, out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], len = b - a; if (len < 0.35) continue;
    if (len <= maxLen * 1.25) { out.push({ in: a, len, scene: i + 1, ...stat(a, b) }); continue; }
    // lange Szene: die bewegtesten Fenster als Highlights
    const wins = []; for (let s = a; s + maxLen <= b + 0.01; s += maxLen / 4) wins.push({ s, ...stat(s, s + maxLen) });
    wins.sort((p, q) => q.motion - p.motion); const pick = [];
    for (const w of wins) { if (pick.length >= Math.max(1, Math.floor(len / maxLen))) break; if (pick.every(p => Math.abs(p.s - w.s) >= maxLen)) pick.push(w); }
    pick.sort((p, q) => p.s - q.s).forEach(w => out.push({ in: w.s, len: maxLen, scene: i + 1, highlight: true, motion: w.motion, bright: w.bright, sat: w.sat, hue: w.hue }));
  }
  const vw = v.videoWidth || 16, vh = v.videoHeight || 9, tw = 160, th = Math.round(tw * vh / vw), tc = document.createElement('canvas'); tc.width = tw; tc.height = th; const tx = tc.getContext('2d');
  const mx = Math.max(...out.map(o => o.motion), 0.001);
  for (let i = 0; i < out.length; i++) {
    const o = out[i]; await seek(v, o.in + Math.min(o.len / 2, 1)); tx.drawImage(v, 0, 0, tw, th); o.thumb = await new Promise(r => tc.toBlob(b => r(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.72));
    o.energy = clamp(o.motion / mx); o.color = hueName(o.hue, o.sat * 1.6, o.bright);
    o.mood = o.energy > 0.66 ? 'dynamisch' : o.energy > 0.33 ? 'bewegt' : 'ruhig'; o.light = o.bright > 0.6 ? 'hell' : o.bright < 0.3 ? 'dunkel' : 'mittel';
    onProgress && onProgress(0.85 + 0.15 * (i + 1) / out.length);
  }
  v.removeAttribute('src'); v.load();
  return { duration: dur, width: vw, height: vh, sequences: out };
}

// Lokaler Schnitt ohne KI: Reihenfolge nach Stil
function heuristicCut(seqs, { len = 15, style = 'energie' } = {}) {
  const idx = seqs.map((s, i) => ({ ...s, i }));
  let order;
  if (style === 'energie') { const top = [...idx].sort((a, b) => b.energy - a.energy); order = [top[0], ...idx.filter(s => s !== top[0]).sort((a, b) => (b.energy - a.energy) * 0.7 + (a.in - b.in) * 0.01)]; }
  else if (style === 'atmo') order = [...idx].sort((a, b) => (a.energy - b.energy) * 0.4 + (a.in - b.in) * 0.02);
  else order = [...idx].sort((a, b) => a.in - b.in);
  const base = style === 'energie' ? 1.1 : style === 'atmo' ? 2.6 : 1.8, trans = style === 'energie' ? ['flash', 'whipR', 'whipL', 'zoom', 'glitch'] : style === 'atmo' ? ['xfade', 'dip', 'xfade'] : ['cut', 'xfade', 'cut'];
  const out = []; let t = 0;
  for (let k = 0; t < len - 0.3; k++) {
    const s = order[k % order.length]; if (!s) break; const d = Math.min(s.len, +(base * (style === 'energie' ? 1.2 - s.energy * 0.5 : 1) + (k === 0 ? 0.8 : 0)).toFixed(2), len - t);
    if (d < 0.35) break; out.push({ i: s.i, dur: +d.toFixed(2), trans: k ? trans[k % trans.length] : 'cut' }); t += d;
    if (k > 60) break;
  }
  return out;
}

// ---------- Grafik: Farbprofil & Ebenen ----------
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Bild konnte nicht geladen werden.')); im.src = src; }); }
function kmeans(data, k, n) {
  const samp = [], stepS = Math.max(1, Math.floor(n / 9000));
  for (let p = 0; p < n; p += stepS) { const i = p * 4; if (data[i + 3] > 24) samp.push([data[i], data[i + 1], data[i + 2]]); }
  if (!samp.length) return [[0, 0, 0]];
  const C = [samp[Math.floor(samp.length / 2)].slice()], d2 = s => Math.min(...C.map(c => (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2));
  while (C.length < k) { let best = null, bd = -1; for (let j = 0; j < samp.length; j += 3) { const d = d2(samp[j]); if (d > bd) { bd = d; best = samp[j]; } } if (!best || bd < 60) break; C.push(best.slice()); }
  for (let it = 0; it < 14; it++) {
    const sum = C.map(() => [0, 0, 0, 0]);
    for (const s of samp) { let bi = 0, bd = 1e12; for (let c = 0; c < C.length; c++) { const d = (s[0] - C[c][0]) ** 2 + (s[1] - C[c][1]) ** 2 + (s[2] - C[c][2]) ** 2; if (d < bd) { bd = d; bi = c; } } const q = sum[bi]; q[0] += s[0]; q[1] += s[1]; q[2] += s[2]; q[3]++; }
    sum.forEach((q, c) => { if (q[3]) C[c] = [q[0] / q[3], q[1] / q[3], q[2] / q[3]]; });
  }
  return C;
}
const nearest = (C, r, g, b) => { let bi = 0, bd = 1e12; for (let c = 0; c < C.length; c++) { const d = (r - C[c][0]) ** 2 + (g - C[c][1]) ** 2 + (b - C[c][2]) ** 2; if (d < bd) { bd = d; bi = c; } } return bi; };

async function decompose(src, opts = {}) {
  const im = await loadImage(src), maxSide = opts.maxSide || 1280, sc = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
  const W = Math.round(im.naturalWidth * sc), H = Math.round(im.naturalHeight * sc), n = W * H;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, W, H);
  const img = cx.getImageData(0, 0, W, H), d = img.data, k = clamp(opts.k || 6, 2, 12);
  let C = kmeans(d, k, n);
  let lab = new Int16Array(n); const cnt = new Array(C.length).fill(0);
  for (let p = 0; p < n; p++) { const i = p * 4; if (d[i + 3] <= 24) { lab[p] = -1; continue; } const c = nearest(C, d[i], d[i + 1], d[i + 2]); lab[p] = c; cnt[c]++; }
  // Speckle-Filter (3×3-Mehrheit)
  const sm = new Int16Array(lab), tmp = new Int16Array(16);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const p = y * W + x; if (lab[p] < 0) continue; tmp.fill(0); let bv = lab[p], bc = 0;
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) { const l = lab[p + yy * W + xx]; if (l >= 0) { const c = ++tmp[l]; if (c > bc) { bc = c; bv = l; } } } if (bc >= 5) sm[p] = bv; }
  lab = sm;
  // nach Häufigkeit sortieren
  const order = C.map((c, i) => i).sort((a, b) => cnt[b] - cnt[a]), remap = new Int16Array(C.length); order.forEach((o, i) => { remap[o] = i; });
  C = order.map(o => C[o]); const counts = order.map(o => cnt[o]); for (let p = 0; p < n; p++) if (lab[p] >= 0) lab[p] = remap[lab[p]];
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  // Hintergrund = häufigste Farbe am Rand
  const edge = new Array(C.length).fill(0); for (let x = 0; x < W; x++) { [lab[x], lab[(H - 1) * W + x]].forEach(l => l >= 0 && edge[l]++); } for (let y = 0; y < H; y++) { [lab[y * W], lab[y * W + W - 1]].forEach(l => l >= 0 && edge[l]++); }
  const bg = edge.some(e => e > 0) ? edge.indexOf(Math.max(...edge)) : 0;
  const palette = C.map((c, i) => ({ hex: hex(c), orig: hex(c), pct: +(counts[i] / total * 100).toFixed(1), bg: i === bg, name: colorName(hex(c)) }));
  const mode = opts.mode || 'objects', layers = [], minArea = Math.max(24, n * (opts.minAreaPct || 0.12) / 100), maxEls = opts.maxEls || 32;
  const crop = (x0, y0, x1, y1, take) => { const w = x1 - x0 + 1, h = y1 - y0 + 1, o = new ImageData(w, h), od = o.data;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = y * W + x; if (!take(p)) continue; const i = p * 4, j = ((y - y0) * w + (x - x0)) * 4; od[j] = d[i]; od[j + 1] = d[i + 1]; od[j + 2] = d[i + 2]; od[j + 3] = d[i + 3]; } return o; };
  if (mode === 'colors') {
    C.forEach((c, ci) => { let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let p = 0; p < n; p++) if (lab[p] === ci) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return; layers.push({ name: (ci === bg ? 'Hintergrund · ' : 'Farbe · ') + palette[ci].name, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, colorIdx: ci, data: crop(x0, y0, x1, y1, p => lab[p] === ci) }); });
    layers.sort((a, b) => (b.colorIdx === bg) - (a.colorIdx === bg) || b.w * b.h - a.w * a.h);
  } else {
    // Hintergrund-Ebene: volle Fläche, Lücken mit Hintergrundfarbe gefüllt
    const bgd = new ImageData(W, H), bd = bgd.data, bc = C[bg];
    for (let p = 0; p < n; p++) { const i = p * 4; if (lab[p] === bg || lab[p] < 0) { bd[i] = d[i]; bd[i + 1] = d[i + 1]; bd[i + 2] = d[i + 2]; bd[i + 3] = d[i + 3]; } else { bd[i] = bc[0]; bd[i + 1] = bc[1]; bd[i + 2] = bc[2]; bd[i + 3] = 255; } }
    layers.push({ name: 'Hintergrund', x: 0, y: 0, w: W, h: H, colorIdx: bg, bg: true, data: bgd });
    // Objekte = zusammenhängende Vordergrund-Flächen (mehrfarbig)
    const comp = new Int32Array(n).fill(-1), comps = [], stack = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (comp[s] !== -1 || lab[s] === bg || lab[s] < 0) continue;
      const id = comps.length; let sp = 0, area = 0, x0 = W, y0 = H, x1 = -1, y1 = -1; const cc = new Array(C.length).fill(0); stack[sp++] = s; comp[s] = id;
      while (sp) { const p = stack[--sp], x = p % W, y = (p / W) | 0; area++; cc[lab[p]]++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
        for (const q of nb) if (q >= 0 && comp[q] === -1 && lab[q] !== bg && lab[q] >= 0) { comp[q] = id; stack[sp++] = q; } }
      comps.push({ id, area, x0, y0, x1, y1, main: cc.indexOf(Math.max(...cc)) });
    }
    const big = comps.filter(c => c.area >= minArea).sort((a, b) => b.area - a.area).slice(0, maxEls), bigSet = new Set(big.map(c => c.id));
    const rest = comps.filter(c => !bigSet.has(c.id));
    if (rest.length) { const rs = new Set(rest.map(c => c.id)); let x0 = W, y0 = H, x1 = -1, y1 = -1; rest.forEach(c => { x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); });
      layers.push({ name: 'Details (' + rest.length + ')', x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, colorIdx: -1, data: crop(x0, y0, x1, y1, p => rs.has(comp[p])) }); }
    big.forEach((c, i) => layers.push({ name: 'Element ' + (i + 1) + ' · ' + palette[c.main].name, x: c.x0, y: c.y0, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1, colorIdx: c.main, data: crop(c.x0, c.y0, c.x1, c.y1, p => comp[p] === c.id) }));
  }
  layers.forEach(l => { let s = 0, m = 0; const dd = l.data.data; for (let i = 0; i < dd.length; i += 16) if (dd[i + 3] > 24) { s += lum(dd[i], dd[i + 1], dd[i + 2]); m++; } l.avgL = m ? s / m : 0.5; });
  return { w: W, h: H, palette, centers: C, layers };
}

// Ebene neu einfärben: Palette-Tausch (Textur bleibt) + optionaler Ton
function recolor(src, centers, targets, tint) {
  const o = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), d = o.data, T = targets.map(t => t && rgb(t)), tn = tint && rgb(tint);
  const changed = T.some((t, i) => t && hex(centers[i]) !== hex(t)); if (!changed && !tn) return o;
  let avg = 0, m = 0; if (tn) for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 24) { avg += lum(d[i], d[i + 1], d[i + 2]); m++; } avg = m ? avg / m : 0.5;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; let r = d[i], g = d[i + 1], b = d[i + 2];
    if (changed) { const c = nearest(centers, r, g, b), t = T[c]; if (t) { const cc = centers[c]; r = t[0] + (r - cc[0]) * 0.85; g = t[1] + (g - cc[1]) * 0.85; b = t[2] + (b - cc[2]) * 0.85; } }
    if (tn) { const f = clamp(lum(r, g, b) / Math.max(0.05, avg), 0, 2.2); r = tn[0] * f; g = tn[1] * f; b = tn[2] * f; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return o;
}
function toCanvas(imgData) { const c = document.createElement('canvas'); c.width = imgData.width; c.height = imgData.height; c.getContext('2d').putImageData(imgData, 0, 0); return c; }
const toBlobURL = imgData => new Promise(r => toCanvas(imgData).toBlob(b => r(URL.createObjectURL(b)), 'image/png'));
const toDataURL = imgData => toCanvas(imgData).toDataURL('image/png');
async function fromDataURL(url) { const im = await loadImage(url), c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); }

// Zusammensetzen für Export
async function composite(doc, outW, outH, fonts) {
  const W = outW || doc.w, H = outH || doc.h, k = W / doc.w, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  if (doc.bg) { x.fillStyle = doc.bg; x.fillRect(0, 0, W, H); }
  for (const l of doc.layers) {
    if (!l.vis) continue; x.save(); x.globalAlpha = l.op ?? 1;
    if (l.type === 'text') {
      const F = (fonts && fonts[l.font]) || ['sans-serif', 700], fs = l.size, pad = l.bg ? fs * 0.22 : 0; x.font = `${F[1]} ${fs}px ${F[0]}`;
      const lines = String(l.text || '').split('\n'), tw = Math.max(...lines.map(s => x.measureText(s).width)), lh = fs * 1.15, bw = tw + pad * 2, bh = lh * lines.length + pad * 2;
      x.scale(k, k); x.translate(l.x + bw / 2, l.y + bh / 2); x.rotate((l.rot || 0) * Math.PI / 180); x.scale(l.s || 1, l.s || 1);
      if (l.bg) { x.fillStyle = l.bg; x.fillRect(-bw / 2, -bh / 2, bw, bh); }
      x.fillStyle = l.color || '#ffffff'; x.textBaseline = 'middle'; x.textAlign = 'center'; lines.forEach((s, i) => x.fillText(s, 0, -bh / 2 + pad + lh * (i + 0.5)));
    } else {
      x.scale(k, k); x.translate(l.x + l.w / 2, l.y + l.h / 2); x.rotate((l.rot || 0) * Math.PI / 180); x.scale(l.s || 1, l.s || 1);
      if (l.type === 'shape') { x.fillStyle = l.fill || '#ffffff'; if (l.shape === 'ellipse') { x.beginPath(); x.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); x.fill(); } else { const r = Math.min(l.radius || 0, l.w / 2, l.h / 2); x.beginPath(); x.roundRect ? x.roundRect(-l.w / 2, -l.h / 2, l.w, l.h, r) : x.rect(-l.w / 2, -l.h / 2, l.w, l.h); x.fill(); } }
      else if (l.url) { const im = await loadImage(l.url); x.drawImage(im, -l.w / 2, -l.h / 2, l.w, l.h); }
    }
    x.restore();
  }
  return new Promise(r => c.toBlob(r, 'image/png'));
}

window.ASMedia = { detectScenes, heuristicCut, decompose, recolor, toBlobURL, toDataURL, fromDataURL, composite, loadImage, hex, rgb, colorName, hueName };
})();
