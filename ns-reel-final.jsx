(function(){
const { useComposition, animate, Easing, clamp, CompositionStage } = window;
const W = 1080, H = 1920, IMG = 'assets/ns-story.jpg', SRC = 'assets/clips/trailer.mp4';
const INK = '#2b2a29', PAPER = '#ede6d8', RED = '#d2161b';
const PIX = "'VT323', monospace", SANS = "'Jost', sans-serif";

const M = {
  enter: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutCubic }),
  pop: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutBack }),
  draw: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeInOutCubic }),
};

// clean shots in the trailer (seconds) — no trailer text overlays
const SHOTS = {
  swing: [7.8, 9.5], crowd: [12.3, 13.9], barrier: [14.1, 14.6],
  selfie: [14.8, 15.5], stage: [16.4, 16.95], phones: [17.25, 17.75], smile: [22.4, 24.3],
};

// on-video copy per ad variant (matches Meta-Ads overview)
const COPY = {
  urgency: { hookA: 'SONNTAG, 19 UHR.', hookB: 'LETZTER FESTIVALTAG.', live: 'ER KOMMT NACH AMORBACH.', cta: 'LETZTER TAG. LETZTER SONG.' },
  fomo: { hookA: 'SONNTAG, 19 UHR.', hookB: 'DU IM SEEGARTEN.', live: 'ER KOMMT NACH AMORBACH.', cta: 'NUR NOCH WENIGE TICKETS.' },
  erlebnis: { hookA: 'SONNENUNTERGANG.', hookB: 'DU IM SEEGARTEN.', live: 'DAS SOMMERRAUSCH-FINALE.', cta: 'DAS FINALE. LIVE.' },
  geschenk: { hookA: 'UNTERM WEIHNACHTSBAUM.', hookB: 'TICKETS FÜR DEN SOMMER.', live: 'DAS GESCHENK: NICO LIVE.', cta: 'DAS GESCHENK FÜR 2027.', stickerA: 'VERSCHENKEN', stickerB: '27.06.2027', stickerC: 'SEEGARTEN', button: 'TICKETS VERSCHENKEN' },
  ankuendigung: { hookA: 'SOMMER 2027.', hookB: 'NICO SANTOS KOMMT.', live: 'ER SPIELT DAS FINALE.', cta: 'POV: DU BIST DABEI.' },
  lastcall: { hookA: 'NOCH 14 TAGE.', hookB: 'DANN IST ES SOWEIT.', live: 'LETZTE CHANCE.', cta: 'LAST CALL · LETZTE TICKETS', stickerA: 'LAST CALL', stickerB: '27.06.', stickerC: 'SO · 19 UHR', button: 'JETZT ODER NIE' },
  direct: { hookA: 'NICO SANTOS LIVE.', hookB: '27.06. AMORBACH.', live: 'SEEGARTEN AMORBACH.', cta: 'SO 27.06.2027 · 19 UHR' },
};

const R = {
  logo: 'polygon(40px 240px,1040px 240px,1040px 440px,40px 440px)',
  pov: 'polygon(70px 445px,575px 445px,575px 608px,70px 608px)',
  hero: 'polygon(575px 470px,1045px 470px,1045px 1248px,60px 1248px,60px 610px,575px 610px)',
  date: 'polygon(60px 1285px,1040px 1285px,1040px 1500px,60px 1500px)',
  tix: 'polygon(60px 1503px,1040px 1503px,1040px 1572px,60px 1572px)',
};

function Region({ clip, style }) {
  return <img src={IMG} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, clipPath: clip, ...style }} />;
}

function Paper() {
  return <div style={{ position: 'absolute', inset: 0, background: PAPER }}>
    {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{
      position: 'absolute', left: 0, top: i * 320, width: W, height: 320,
      backgroundImage: `url(${IMG})`, backgroundSize: `${W}px ${H}px`, backgroundPosition: '0 -1590px',
      transform: i % 2 ? 'scaleY(-1)' : 'none',
    }} />)}
  </div>;
}

// blob URL so the trailer is fully seekable (server lacks range support)
let blobP = null;
function useSrc() {
  const [u, setU] = React.useState(window.__nsTrailerURL || null);
  React.useEffect(() => {
    if (u) return;
    blobP = blobP || fetch(SRC).then(r => r.blob()).then(b => (window.__nsTrailerURL = URL.createObjectURL(b))).catch(() => SRC);
    let live = true; blobP.then(x => live && setU(x)); return () => { live = false; };
  }, []);
  return u;
}

function useSyncedMedia(ref, ok, from, to, offset, volume, rate = 1) {
  const { T, playing } = useComposition();
  React.useLayoutEffect(() => {
    const v = ref.current; if (!v || !ok) return;
    const vis = T >= from && T < to;
    const target = offset + Math.max(0, T - from) * rate;
    if (volume != null) v.volume = clamp(volume, 0, 1);
    if (!vis) { if (!v.paused) v.pause(); if (T < from && Math.abs(v.currentTime - offset) > 0.05) v.currentTime = offset; return; }
    if (playing) {
      if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate;
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) > 0.02) v.currentTime = target;
    }
  });
  return T;
}

// ---------- audio engine: mastering chain for music + synthesized SFX ----------
const AE = (() => {
  let ctx = null, lim, duck, mIn, mBus, sBus, noise, lastM = -1;
  const routed = new WeakMap();
  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    const out = ctx.createGain(); out.gain.value = 0.92; lim.connect(out); out.connect(ctx.destination);
    duck = ctx.createGain(); duck.connect(lim);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.7;
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 320; mud.Q.value = 0.9; mud.gain.value = -2.5;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 0.8; pres.gain.value = 1.5;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 10000; air.gain.value = 2;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.02; glue.release.value = 0.25;
    mBus = ctx.createGain(); mBus.gain.value = 0;
    hp.connect(mud); mud.connect(pres); pres.connect(air); air.connect(glue); glue.connect(mBus); mBus.connect(duck);
    mIn = hp;
    sBus = ctx.createGain(); sBus.gain.value = 0.7; sBus.connect(lim);
    const len = ctx.sampleRate * 2; noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const wake = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, wake, true));
    return ctx;
  }
  const live = () => { init(); if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); return !!ctx && ctx.state === 'running'; };
  // only route through the graph once audio is running — otherwise the element plays directly
  function route(v) {
    if (routed.has(v)) return routed.get(v);
    if (!live()) return false;
    try { ctx.createMediaElementSource(v).connect(mIn); routed.set(v, true); return true; } catch (e) { routed.set(v, false); return false; }
  }
  function music(level) {
    if (!ctx || Math.abs(level - lastM) < 0.004) return; lastM = level;
    mBus.gain.setTargetAtTime(level, ctx.currentTime, 0.05);
  }
  function ducking(depth) {
    const t = ctx.currentTime; duck.gain.cancelScheduledValues(t);
    duck.gain.setTargetAtTime(depth, t, 0.01); duck.gain.setTargetAtTime(1, t + 0.12, 0.22);
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function nz(t, dur) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; }
  function osc(t, f0, f1, dur, type = 'sine') {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  function pan(node, from, to, t, d) {
    if (!ctx.createStereoPanner) return node; const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(from, t); p.pan.linearRampToValueAtTime(to, t + d); node.connect(p); return p;
  }
  const FX = {
    whoosh(o) {
      const t = ctx.currentTime, d = o.dur || 0.45, pk = d * 0.7, dir = o.dir || 1;
      const bp = filt('bandpass', 350, 1.3);
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(3400, t + pk); bp.frequency.exponentialRampToValueAtTime(900, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.v || 0.5, t + pk); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      pan(chain(nz(t, d), bp, g), -0.6 * dir, 0.6 * dir, t, d).connect(sBus);
    },
    impact(o) {
      const t = ctx.currentTime, v = o.v || 0.7;
      const g = ctx.createGain(); env(g, t, 0.004, v, 0.5); chain(osc(t, 120, 40, 0.4), g, sBus);
      const g2 = ctx.createGain(); env(g2, t, 0.002, v * 0.22, 0.09); chain(nz(t, 0.12), filt('highpass', 1800), g2, sBus);
      ducking(1 - v * 0.45);
    },
    riser(o) {
      const t = ctx.currentTime, d = o.dur || 0.9, hp = filt('highpass', 200, 2);
      hp.frequency.setValueAtTime(200, t); hp.frequency.exponentialRampToValueAtTime(5500, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.v || 0.22, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04);
      chain(nz(t, d + 0.05), hp, g, sBus);
    },
    stamp(o) {
      const t = ctx.currentTime, v = o.v || 0.6;
      const g = ctx.createGain(); env(g, t, 0.003, v, 0.22); chain(osc(t, 95, 45, 0.22), g, sBus);
      const g2 = ctx.createGain(); env(g2, t, 0.002, v * 0.4, 0.05); chain(nz(t, 0.08), filt('lowpass', 1300), g2, sBus);
      ducking(1 - v * 0.35);
    },
    beep() {
      const t = ctx.currentTime;
      [0, 0.15].forEach(dt => { const g = ctx.createGain(); env(g, t + dt, 0.004, 0.1, 0.07); chain(osc(t + dt, 1950, 1950, 0.09), g, sBus); });
    },
    tick(o) {
      const t = ctx.currentTime, g = ctx.createGain(); env(g, t, 0.001, o.v || 0.1, 0.03);
      chain(nz(t, 0.05), filt('highpass', 3800), g, sBus);
    },
    pop(o) {
      const t = ctx.currentTime, g = ctx.createGain(); env(g, t, 0.004, o.v || 0.18, 0.13);
      chain(osc(t, 520, 900, 0.08), g, sBus);
    },
  };
  return {
    route, music,
    fx(c, level) { if (!live() || !FX[c.fx]) return; sBus.gain.setTargetAtTime(level, ctx.currentTime, 0.02); try { FX[c.fx](c); } catch (e) {} },
  };
})();

// fires SFX cues as the playhead crosses them (cue.at - cue.lead = start, so whooshes peak on the cut)
function useSfx(cues, on, level) {
  const { T, playing } = useComposition();
  const prev = React.useRef(T);
  React.useLayoutEffect(() => {
    let p = prev.current; prev.current = T;
    if (!playing || !on) return;
    if (T < p) p = -1; else if (T - p > 0.3) return;
    for (const c of cues) { const s = Math.max(0, c.at - (c.lead || 0)); if (s > p && s <= T) AE.fx(c, level); }
  });
}

const TAIL = 0.16;
// a shot from the trailer, time-stretched to fill its slot (speed ramp).
// Incoming whip: blurred dissolve + slide over the still-moving outgoing shot (tail) — no hard cut, no empty edges.
function Shot({ shot, from, to, zoom = [1, 1.08], whip, tail = TAIL }) {
  const ref = React.useRef(null);
  const [ok, setOk] = React.useState(null);
  const url = useSrc();
  const [a, b] = SHOTS[shot];
  const rate = clamp((b - a) / Math.max(0.1, to - from), 0.35, 2.5);
  const T = useSyncedMedia(ref, ok, from, to + tail, a, 0, rate);
  const vis = T >= from && T < to + tail;
  const s = M.draw(zoom[0], zoom[1], from, to)(T);
  const w = whip ? M.enter(1, 0, from, from + 0.2)(T) : 0;
  const op = whip ? M.enter(0, 1, from, from + 0.12)(T) : 1;
  const e = tail ? M.enter(0, 1, to, to + tail)(T) : 0;
  const blur = w * 14 + e * 10;
  return <div style={{ position: 'absolute', inset: 0, opacity: vis ? op : 0, overflow: 'hidden' }}>
    {url && <video ref={ref} src={url} playsInline preload="auto" muted
      onLoadedData={() => setOk(true)} onError={() => setOk(false)}
      style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover',
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        transform: `translateX(${w * (whip || 0) * 110}px) scale(${s * (1 + 0.08 * w + 0.05 * e)})` }} />}
  </div>;
}

// music: trailer audio through EQ/compressor/limiter, gain ramps (no zipper/clicks),
// drift corrected by nudging playbackRate instead of audible seeks
function Music({ from, to, offset, vol, muted }) {
  const ref = React.useRef(null);
  const [ok, setOk] = React.useState(null);
  const url = useSrc();
  const { T, playing } = useComposition();
  React.useLayoutEffect(() => {
    const v = ref.current; if (!v || !ok) return;
    const level = muted ? 0 : clamp(vol, 0, 1);
    const routed = AE.route(v);
    const on = playing && T >= from && T < to;
    if (routed) { v.volume = 1; AE.music(on ? level : 0); } else v.volume = level;
    const target = offset + clamp(T - from, 0, to - from);
    if (!on) {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) > 0.05) v.currentTime = target;
      return;
    }
    const d = target - v.currentTime;
    if (v.paused) { if (Math.abs(d) > 0.05) v.currentTime = target; v.play().catch(() => {}); return; }
    if (Math.abs(d) > 0.5) { v.currentTime = target; v.playbackRate = 1; }
    else if (Math.abs(d) > 0.04) v.playbackRate = 1 + clamp(d * 0.5, -0.05, 0.05);
    else if (v.playbackRate !== 1) v.playbackRate = 1;
  });
  if (!url) return null;
  return <video ref={ref} src={url} preload="auto" playsInline muted={!!muted}
    data-om-exportable-video-play-start={offset} data-om-exportable-video-play-end={offset + (to - from)}
    onLoadedData={() => setOk(true)} onError={() => setOk(false)}
    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />;
}

function tc(T) {
  const f = Math.floor((T % 1) * 25), s = Math.floor(T) % 60;
  const p = n => String(n).padStart(2, '0');
  return `00:00:${p(s)}:${p(f)}`;
}

function Viewfinder({ T, place }) {
  const rec = Math.floor(T * 2) % 2 === 0;
  const bracket = (pos) => <div style={{ position: 'absolute', width: 70, height: 70, borderColor: '#fff', borderStyle: 'solid', borderWidth: 0, ...pos }} />;
  return <div style={{ position: 'absolute', inset: 0, fontFamily: PIX, color: '#f4f1ea', textShadow: '0 2px 6px rgba(0,0,0,.6)', pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 2px,transparent 2px 5px)', mixBlendMode: 'multiply' }} />
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)' }} />
    {bracket({ left: 60, top: 250, borderTopWidth: 5, borderLeftWidth: 5 })}
    {bracket({ right: 60, top: 250, borderTopWidth: 5, borderRightWidth: 5 })}
    {bracket({ left: 60, top: 1430, borderBottomWidth: 5, borderLeftWidth: 5 })}
    {bracket({ right: 60, top: 1430, borderBottomWidth: 5, borderRightWidth: 5 })}
    <div style={{ position: 'absolute', left: 100, top: 280, display: 'flex', alignItems: 'center', gap: 16, fontSize: 56 }}>
      <span style={{ width: 30, height: 30, borderRadius: 15, background: RED, opacity: rec ? 1 : 0.15 }} /><span>REC</span>
    </div>
    <div style={{ position: 'absolute', right: 100, top: 280, fontSize: 48 }}>{tc(T)}</div>
    <div style={{ position: 'absolute', left: 100, top: 1405, fontSize: 46 }}>JUN 27 2027  19:00</div>
    <div style={{ position: 'absolute', right: 100, top: 1405, fontSize: 46 }}>{place}</div>
  </div>;
}

// warm light-leak drifting over live footage
function Leak({ T, strength = 1 }) {
  const a = (0.22 + 0.14 * Math.sin(T * 1.7)) * strength;
  const x = 30 + 40 * Math.sin(T * 0.6);
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', opacity: a,
    background: `radial-gradient(ellipse 70% 45% at ${x}% 18%, rgba(255,150,60,.9), transparent 70%)` }} />;
}

function Caption({ text, x, y, size, bg, color, style }) {
  return <div style={{ position: 'absolute', left: x, top: y, fontFamily: PIX, fontSize: size, lineHeight: 1,
    padding: '8px 22px 4px', background: bg, color, whiteSpace: 'nowrap', letterSpacing: '0.04em', ...style }}>{text}</div>;
}

// pop in, then zoom-out exit (scale up + fade)
function inOut(T, inAt, outAt, base = 0.7) {
  const p = M.pop(0, 1, inAt, inAt + 0.3)(T);
  const o = M.enter(0, 1, outAt - 0.25, outAt)(T);
  return { opacity: clamp(p, 0, 1) * (1 - o), scale: (base + (1 - base) * p) * (1 + 0.35 * o) };
}

function typed(text, T, start, cps) {
  return text.slice(0, clamp(Math.floor((T - start) * cps), 0, text.length));
}

function Flash({ T, at }) {
  const a = T < at ? M.enter(0, 1, at - 0.05, at)(T) : M.enter(1, 0, at, at + 0.34)(T);
  return <div style={{ position: 'absolute', inset: 0, background: '#fff8ec', opacity: a * 0.72, pointerEvents: 'none' }} />;
}

const BASE = { pov: 'POV:', song0: 'DIE HITS. LIVE.', song1: 'ROOFTOP', song2: 'UNFORGETTABLE', song3: 'LIKE I LOVE YOU', stickerA: 'SONNTAG', stickerB: '19 UHR', stickerC: 'FESTIVAL-FINALE', button: 'TICKETS SICHERN' };
const TEXT_KEYS = [['pov', 'POV-Titel'], ['hookA', 'Hook Zeile 1'], ['hookB', 'Hook Zeile 2'], ['live', 'Live-Caption'], ['song0', 'Songs: Intro'], ['song1', 'Song 1'], ['song2', 'Song 2'], ['song3', 'Song 3 (rot)'], ['stickerA', 'Sticker Zeile 1'], ['stickerB', 'Sticker Zeile 2'], ['stickerC', 'Sticker klein'], ['cta', 'CTA-Headline'], ['button', 'Button']];
function presetFor(t) { return { ...BASE, ...(COPY[t.copyVariant] || COPY.urgency) }; }
function textsFor(t) { const p = presetFor(t), o = {}; TEXT_KEYS.forEach(([k]) => { const v = t['t_' + k]; o[k] = v != null && v !== '' ? v : p[k]; }); return o; }

function Piece() {
  const { T, CUES, authoredTotal } = useComposition();
  const [t] = window.useTweaks(window.TWEAK_DEFAULTS);
  const copy = textsFor(t);
  const H0 = CUES.Hook, L = CUES.Live, Rv = CUES.Reveal, S = CUES.Songs, I = CUES.Info, C = CUES.CTA, END = authoredTotal;
  const short = END < 18;

  const pov = typed(copy.pov, T, H0 + 0.15, 9);
  const hookOut = M.enter(0, 1, L - 0.25, L)(T);
  const hA = inOut(T, H0 + 0.7, L), hB = inOut(T, H0 + 1.15, L);
  const lv = inOut(T, L + 0.3, Rv, 0.6);
  const liveMid = L + (Rv - L) * 0.55;

  const posterVis = T >= Rv;
  const wipe = M.draw(100, 0, Rv + 0.1, Rv + 0.9)(T);
  const heroScale = M.enter(1.14, 1, Rv, Rv + 1.6)(T);
  const realPov = M.enter(0, 1, Rv + 0.5, Rv + 0.9)(T);
  const logoIn = M.enter(0, 1, I, I + 0.5)(T);
  const dateIn = M.pop(0, 1, I + 0.4, I + 0.85)(T);
  const stickerIn = M.pop(0, 1, I + (short ? 1.0 : 1.4), I + (short ? 1.4 : 1.8))(T);
  const tixIn = M.enter(0, 1, C, C + 0.4)(T);
  const full = M.enter(0, 1, C + 0.3, C + 0.9)(T);
  const ctaIn = M.pop(0, 1, C + 0.2, C + 0.55)(T);
  const btnIn = M.pop(0, 1, C + 0.5, C + 0.9)(T);
  const pulse = T > C + 0.9 ? 1 + 0.035 * Math.sin((T - C) * 6) : 1;
  const fadeOut = M.draw(1, 0, END - 0.4, END)(T);
  const posterPush = M.draw(1, 1.04, Rv, I)(T);

  const sd = (I - S) / 4;
  const cuts = ['selfie', 'stage', 'phones', 'smile'];
  const songs = [[copy.song0, 0.15, INK, 64], [copy.song1, sd, INK, 124], [copy.song2, 2 * sd, INK, 124], [copy.song3, 3 * sd, RED, 124]];
  const songsOut = M.enter(0, 1, I - 0.3, I)(T);
  const clipLive = T >= S && T < I;
  const onClip = T < Rv || clipLive;

  const cues = React.useMemo(() => [
    { at: H0 + 0.05, fx: 'beep' },
    { at: H0 + 0.7, fx: 'tick' }, { at: H0 + 1.15, fx: 'tick' },
    { at: L, fx: 'whoosh', dur: 0.45, lead: 0.32, dir: 1, v: 0.45 }, { at: L, fx: 'impact', v: 0.45 },
    { at: L + 0.3, fx: 'tick' },
    { at: liveMid, fx: 'whoosh', dur: 0.4, lead: 0.28, dir: -1, v: 0.38 },
    { at: Rv, fx: 'riser', dur: 0.9, lead: 0.9, v: 0.2 }, { at: Rv, fx: 'impact', v: 0.8 },
    { at: Rv + 0.25, fx: 'whoosh', dur: 0.7, lead: 0.1, dir: 1, v: 0.22 },
    { at: S, fx: 'impact', v: 0.6 }, { at: S + 0.15, fx: 'tick' },
    ...[1, 2, 3].map(k => ({ at: S + k * sd, fx: 'whoosh', dur: 0.32, lead: 0.22, dir: k % 2 ? -1 : 1, v: 0.34 })),
    ...[1, 2, 3].map(k => ({ at: S + k * sd + 0.04, fx: 'tick', v: 0.08 })),
    { at: I, fx: 'impact', v: 0.5 },
    { at: I + 0.62, fx: 'stamp', v: 0.6 },
    ...(t.showSticker ? [{ at: I + (short ? 1.18 : 1.58), fx: 'stamp', v: 0.32 }] : []),
    { at: C, fx: 'whoosh', dur: 0.4, lead: 0.2, dir: -1, v: 0.28 }, { at: C + 0.32, fx: 'tick' }, { at: C + 0.68, fx: 'pop' },
  ], [H0, L, Rv, S, I, C, sd, liveMid, short, t.showSticker]);
  useSfx(cues, t.sfx !== false, clamp((t.sfxLevel ?? 70) / 100, 0, 1));

  // music: trailer audio (Rooftop) — quiet under hook, swells on first live cut
  const vol = M.enter(0, 0.35, 0, 0.5)(T) + M.draw(0, 0.65, L - 0.2, L + 0.3)(T);
  const mLevel = clamp((t.musicLevel ?? 100) / 100, 0, 1.5);
  // publish the track layout for the track panel below the stage
  window.__nsTL = { T, END, musicStart: t.musicStart, music: !!t.sound, sfx: t.sfx !== false,
    scenes: [['Hook', H0, L], ['Live', L, Rv], ['Reveal', Rv, S], ['Songs', S, I], ['Info', I, C], ['CTA', C, END]],
    texts: [[copy.pov, H0 + 0.15, L], [copy.hookA, H0 + 0.7, L], [copy.hookB, H0 + 1.15, L], [copy.live, L + 0.3, Rv],
      ...songs.map(([s, at]) => [s, S + at, I]), ...(t.showSticker ? [[copy.stickerA + ' ' + copy.stickerB, I + (short ? 1.0 : 1.4), END]] : []),
      [copy.cta, C + 0.2, END], [copy.button, C + 0.5, END]],
    cues, envAt: x => (M.enter(0, 0.35, 0, 0.5)(x) + M.draw(0, 0.65, L - 0.2, L + 0.3)(x)) * M.draw(1, 0, END - 1.0, END)(x) * mLevel };

  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: PAPER }}>
    <Music from={0} to={END} offset={t.musicStart} muted={!t.sound} vol={vol * mLevel * M.draw(1, 0, END - 1.0, END)(T)} />

    <Shot shot="swing" from={H0} to={L} zoom={[1.0, 1.12]} />
    <Shot shot="crowd" from={L} to={liveMid} whip={1} zoom={[1.05, 1.15]} />
    <Shot shot="barrier" from={liveMid} to={Rv} whip={-1} zoom={[1.15, 1.0]} />
    {cuts.map((c, i) => <Shot key={c} shot={c} from={S + i * sd} to={S + (i + 1) * sd} whip={i ? (i % 2 ? -1 : 1) : 0} zoom={i % 2 ? [1.12, 1.0] : [1.0, 1.12]} />)}

    {onClip && <Leak T={T} strength={T < L ? 0.7 : 1} />}
    {T < L && <Viewfinder T={T} place="SEEGARTEN" />}
    {T >= L && T < Rv && <Viewfinder T={T} place="AMORBACH" />}
    {clipLive && <Viewfinder T={T} place="LIVE" />}

    {posterVis && !clipLive && <div style={{ position: 'absolute', inset: 0 }}>
      <Paper />
      <div style={{ position: 'absolute', inset: 0, opacity: fadeOut, transform: `scale(${posterPush})`, transformOrigin: '540px 860px' }}>
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${wipe}% 0 0)`, transform: `scale(${heroScale})`, transformOrigin: '540px 860px' }}>
          <Region clip={R.hero} />
        </div>
        {wipe > 0.5 && wipe < 99.5 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${100 - wipe}% - 70px)`, width: 90, background: 'linear-gradient(90deg,transparent,rgba(255,248,236,.85))', filter: 'blur(6px)' }} />}
        <Region clip={R.pov} style={{ opacity: realPov }} />
        <Region clip={R.logo} style={{ opacity: logoIn, transform: `translateY(${(1 - logoIn) * -90}px)` }} />
        <Region clip={R.date} style={{ opacity: clamp(dateIn, 0, 1), transform: `scale(${1.25 - 0.25 * dateIn})`, transformOrigin: '540px 1400px' }} />
        <Region clip={R.tix} style={{ opacity: tixIn }} />
        <img src={IMG} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: full }} />
      </div>
    </div>}

    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut }}>
      {T < L && <>
        <div style={{ position: 'absolute', left: 100, top: 560, fontFamily: PIX, fontSize: 300, lineHeight: 0.8, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,.5)', opacity: 1 - hookOut, transform: `scale(${1 + 0.3 * hookOut})`, transformOrigin: '0 50%' }}>{pov}</div>
        <Caption text={copy.hookA} x={100} y={860} size={92} bg={INK} color={PAPER} style={{ opacity: hA.opacity, transform: `scale(${hA.scale})`, transformOrigin: '0 50%' }} />
        <Caption text={copy.hookB} x={100} y={975} size={92} bg={RED} color={PAPER} style={{ opacity: hB.opacity, transform: `scale(${hB.scale})`, transformOrigin: '0 50%' }} />
      </>}
      {T >= L && T < Rv && <Caption text={copy.live} x={90} y={900} size={short ? 76 : 84} bg={PAPER} color={INK}
        style={{ opacity: lv.opacity, transform: `scale(${lv.scale}) rotate(-1.5deg)`, transformOrigin: '0 50%' }} />}
      {clipLive && songs.map(([txt, at, bg, size], i) => {
        const p = M.pop(0, 1, S + at, S + at + 0.3)(T);
        return <Caption key={i} text={txt} x={90} y={700 + i * 150 + (i ? 0 : 40)} size={size} bg={bg} color={PAPER}
          style={{ opacity: clamp(p, 0, 1) * (1 - songsOut), transform: `scale(${(0.6 + 0.4 * p) * (1 + 0.3 * songsOut)}) rotate(${i % 2 ? 1.5 : -1.5}deg)`, transformOrigin: '0 50%' }} />;
      })}
      {posterVis && !clipLive && t.showSticker && <div style={{ position: 'absolute', left: 765, top: 1130, width: 300, padding: '18px 0 14px', background: RED, color: PAPER, textAlign: 'center',
        fontFamily: SANS, fontWeight: 600, fontSize: 40, lineHeight: 1.05, letterSpacing: '0.04em',
        opacity: clamp(stickerIn, 0, 1), transform: `rotate(-6deg) scale(${stickerIn})` }}>{copy.stickerA}<br />{copy.stickerB}<div style={{ fontFamily: PIX, fontSize: 34, marginTop: 6, letterSpacing: '0.06em' }}>{copy.stickerC}</div></div>}
      {T >= C && <div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: PIX, fontSize: 84, lineHeight: 1, padding: '10px 26px 4px', background: RED, color: PAPER, letterSpacing: '0.04em', whiteSpace: 'nowrap',
          opacity: clamp(ctaIn, 0, 1), transform: `scale(${0.6 + 0.4 * ctaIn}) rotate(-1.5deg)` }}>{copy.cta}</div>
      </div>}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 1600, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        background: INK, color: PAPER, fontFamily: PIX, fontSize: 72, letterSpacing: '0.06em',
        opacity: clamp(btnIn, 0, 1), transform: `scale(${btnIn * pulse})` }}>{copy.button} <span style={{ color: RED }}>&gt;&gt;</span></div>
    </div>

    {[L, Rv, S, I].map(at => <Flash key={at} T={T} at={at} />)}
  </div>;
}

const FX_LABEL = { beep: 'REC-Piep', tick: 'Klick', whoosh: 'Whoosh', impact: 'Hit', riser: 'Riser', stamp: 'Stempel', pop: 'Pop' };
const FX_COLOR = { beep: '#8fb3ff', tick: '#bbb', whoosh: '#6fd3c4', impact: '#ff6a5c', riser: '#f2b84b', stamp: '#e58cff', pop: '#9be27a' };
// multitrack view under the stage: video scenes, texts, music (waveform + volume curve), SFX
function TrackPanel({ onToggle }) {
  const [, force] = React.useState(0);
  const [peaks, setPeaks] = React.useState(null);
  React.useEffect(() => { let r; const loop = () => { force(n => n + 1); r = requestAnimationFrame(loop); }; r = requestAnimationFrame(loop); return () => cancelAnimationFrame(r); }, []);
  React.useEffect(() => {
    let dead = false;
    fetch(SRC).then(r => r.arrayBuffer()).then(buf => new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100).decodeAudioData(buf)).then(ab => {
      const d = ab.getChannelData(0), sr = ab.sampleRate, step = Math.floor(sr / 50), out = [];
      for (let i = 0; i < d.length; i += step) { let m = 0; for (let j = i; j < i + step && j < d.length; j += 8) m = Math.max(m, Math.abs(d[j])); out.push(m); }
      if (!dead) setPeaks(out);
    }).catch(() => {});
    return () => { dead = true; };
  }, []);
  const tl = window.__nsTL; if (!tl) return null;
  const pct = x => (100 * x / tl.END) + '%';
  const lane = (label, sub, on, toggleKey, children, hgt = 34) => <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', borderTop: '1px solid #3a3836' }}>
    <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ede6d8' }}>
      {toggleKey ? <button onClick={() => onToggle(toggleKey, !on)} title={on ? 'Stumm schalten' : 'Einschalten'} style={{ width: 22, height: 22, border: '1px solid #6b6763', background: on ? 'transparent' : '#d2161b', color: '#ede6d8', font: '600 11px Jost,sans-serif', cursor: 'pointer', padding: 0 }}>M</button> : <span style={{ width: 22 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span style={{ fontWeight: 600 }}>{label}</span><span style={{ opacity: .6, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span></div>
    </div>
    <div style={{ position: 'relative', height: hgt, opacity: on === false ? 0.35 : 1 }}>{children}</div>
  </div>;
  const textRows = [[], []]; tl.texts.forEach((x, i) => textRows[i % 2].push(x));
  const N = 140, wave = [];
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * tl.END / N, idx = Math.floor((tl.musicStart + x) * 50);
    const p = peaks ? (peaks[idx] || 0) : 0.15; wave.push([x, p, tl.envAt(x)]);
  }
  return <div style={{ background: '#242322', fontFamily: "'Jost',sans-serif", userSelect: 'none', position: 'relative' }}>
    {lane('Video', 'Trailer-Szenen', null, null, tl.scenes.map(([n, a, b]) => <div key={n} style={{ position: 'absolute', left: pct(a), width: `calc(${pct(b - a)} - 2px)`, top: 5, bottom: 5, background: n === 'Reveal' || n === 'Info' ? '#5a5047' : '#3f5a66', color: '#ede6d8', fontSize: 11, padding: '3px 6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{n}</div>))}
    {lane('Text', tl.texts.length + ' Einblendungen', null, null, textRows.map((row, r) => row.map(([s, a, b], i) => <div key={r + '-' + i} title={s} style={{ position: 'absolute', left: pct(a), width: `calc(${pct(b - a)} - 2px)`, top: 4 + r * 22, height: 18, background: '#d2161b', color: '#ede6d8', fontSize: 10, padding: '2px 5px', overflow: 'hidden', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>{s}</div>)), 48)}
    {lane('Musik', 'Rooftop · Trailer ab ' + tl.musicStart + ' s', tl.music, 'sound', <>
      <div style={{ position: 'absolute', inset: '4px 0', display: 'flex', alignItems: 'center', gap: 1 }}>
        {wave.map(([x, p, e], i) => <div key={i} style={{ flex: 1, height: Math.max(2, p * 46 * (0.25 + 0.75 * Math.min(1, e))) , background: '#6fd3c4', opacity: 0.35 + 0.65 * Math.min(1, e) }} />)}
      </div>
      <div style={{ position: 'absolute', left: 4, top: 2, fontSize: 10, color: '#ede6d8', opacity: .7 }}>Lautstärke-Kurve</div>
    </>, 52)}
    {lane('Effekte', tl.cues.length + ' Sounds', tl.sfx, 'sfx', tl.cues.map((c, i) => <div key={i} title={FX_LABEL[c.fx] + ' @ ' + c.at.toFixed(2) + ' s'} style={{ position: 'absolute', left: pct(Math.max(0, c.at - (c.lead || 0))), width: Math.max(4, 100 * ((c.dur || 0.12)) / tl.END) + '%', top: c.fx === 'tick' || c.fx === 'pop' ? 22 : 6, height: c.fx === 'tick' || c.fx === 'pop' ? 12 : 16, background: FX_COLOR[c.fx], opacity: 0.85, fontSize: 9, color: '#1d1c1b', overflow: 'hidden', whiteSpace: 'nowrap', padding: '1px 3px', boxSizing: 'border-box' }}>{c.fx === 'tick' ? '' : FX_LABEL[c.fx]}</div>), 40)}
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(170px + (100% - 170px) * ${tl.T / tl.END})`, width: 2, background: '#fff', pointerEvents: 'none' }} />
  </div>;
}

function NSReelFinal() {
  const [t, setTweak] = window.useTweaks(window.TWEAK_DEFAULTS);
  const preset = presetFor(t);
  return <>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={PAPER}>
          <Piece />
        </CompositionStage>
      </div>
      {t.showTracks !== false && <TrackPanel onToggle={setTweak} />}
    </div>
    <window.TweaksPanel>
      <window.TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
      <window.TweakSelect label="Werbetext-Variante" value={t.copyVariant} onChange={v => setTweak('copyVariant', v)}
        options={[{ value: 'geschenk', label: 'Phase 1 · Geschenk (Okt–Dez)' }, { value: 'ankuendigung', label: 'Phase 2 · Ankündigung (Jan–Apr)' }, { value: 'lastcall', label: 'Phase 4 · Last Call (14 Tage)' }, { value: 'urgency', label: 'Urgency · Letzter Tag' }, { value: 'fomo', label: 'FOMO · Wenige Tickets' }, { value: 'erlebnis', label: 'Erlebnis · Das Finale' }, { value: 'direct', label: 'Direct CTA' }]} />
      <window.TweakToggle label="Tonspuren anzeigen" value={t.showTracks !== false} onChange={v => setTweak('showTracks', v)} />
      <window.TweakSection label="Texte im Video (leer = Vorlage)">
        {TEXT_KEYS.map(([k, l]) => <window.TweakText key={k} label={l} value={t['t_' + k] || ''} placeholder={preset[k]} onChange={v => setTweak('t_' + k, v)} />)}
      </window.TweakSection>
      <window.TweakSection label="Ton">
      <window.TweakNumber label="Musik-Lautstärke (%)" value={t.musicLevel ?? 100} min={0} max={150} step={5} onChange={v => setTweak('musicLevel', v)} />
      <window.TweakToggle label="Ton (Rooftop aus Trailer)" value={t.sound} onChange={v => setTweak('sound', v)} />
      <window.TweakToggle label="Effekttöne" value={t.sfx !== false} onChange={v => setTweak('sfx', v)} />
      <window.TweakNumber label="Effekt-Lautstärke (%)" value={t.sfxLevel ?? 70} min={0} max={100} step={5} onChange={v => setTweak('sfxLevel', v)} />
      </window.TweakSection>
      <window.TweakToggle label="Sticker einblenden" value={t.showSticker} onChange={v => setTweak('showSticker', v)} />
      <window.TweakNumber label="Musik ab (Sek. im Trailer)" value={t.musicStart} min={0} max={20} step={0.5} onChange={v => setTweak('musicStart', v)} />
    </window.TweaksPanel>
  </>;
}
window.NSReelFinal = NSReelFinal;
})();
