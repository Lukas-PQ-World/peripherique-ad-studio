(function(){
const { useComposition, animate, Easing, clamp, CompositionStage } = window;
const W = 1080, H = 1920, IMG = 'assets/ns-story.jpg';
const INK = '#2b2a29', PAPER = '#ede6d8', RED = '#d2161b';
const PIX = "'VT323', monospace", SANS = "'Jost', sans-serif";

// three motion helpers — no other easing in this file
const M = {
  enter: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutCubic }),
  pop: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutBack }),
  draw: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeInOutCubic }),
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

// media synced to the authored clock; exporter reads the data-om-* attrs for audio
function useSyncedMedia(ref, ok, from, to, offset, volume) {
  const { T, playing } = useComposition();
  React.useLayoutEffect(() => {
    const v = ref.current; if (!v || !ok) return;
    const vis = T >= from && T < to;
    const target = offset + Math.max(0, T - from);
    if (volume != null) v.volume = clamp(volume, 0, 1);
    if (!vis) { if (!v.paused) v.pause(); return; }
    if (playing) {
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) > 0.02) v.currentTime = target;
    }
  });
  return T;
}

function Clip({ src, from, to, offset = 0, label, filter, zoom = [1, 1.08], muted }) {
  const ref = React.useRef(null);
  const [ok, setOk] = React.useState(null);
  const T = useSyncedMedia(ref, ok, from, to, offset, muted ? 0 : 0.35);
  const vis = T >= from && T < to;
  const s = M.draw(zoom[0], zoom[1], from, to)(T);
  return <div style={{ position: 'absolute', inset: 0, opacity: vis ? 1 : 0, overflow: 'hidden', background: '#111' }}>
    <video ref={ref} src={src} playsInline preload="auto" muted={!!muted}
      data-om-exportable-video-play-start={offset} data-om-exportable-video-play-end={offset + (to - from)}
      onLoadedData={() => setOk(true)} onError={() => setOk(false)}
      style={{ position: 'absolute', inset: 0, width: W, height: H, objectFit: 'cover', filter, transform: `scale(${s})`, display: ok === false ? 'none' : 'block' }} />
    {ok !== true && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 560, boxSizing: 'border-box',
      background: 'repeating-linear-gradient(135deg,#2a2826 0 22px,#232120 22px 44px)', color: '#9a948a', fontFamily: 'ui-monospace,monospace', fontSize: 30, textAlign: 'center', lineHeight: 1.5 }}>
      <div>{label}<br /><span style={{ fontSize: 24, opacity: 0.8 }}>{src}</span></div>
    </div>}
  </div>;
}

function Music({ src, from, to, offset, vol, muted }) {
  const ref = React.useRef(null);
  const [ok, setOk] = React.useState(null);
  useSyncedMedia(ref, ok, from, to, offset, muted ? 0 : vol);
  return <video ref={ref} src={src} preload="auto" playsInline muted={!!muted}
    data-om-exportable-video-play-start={offset} data-om-exportable-video-play-end={offset + (to - from)}
    onLoadedData={() => setOk(true)} onError={() => setOk(false)}
    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />;
}

function tc(T) {
  const f = Math.floor((T % 1) * 25), s = Math.floor(T) % 60;
  const p = n => String(n).padStart(2, '0');
  return `00:00:${p(s)}:${p(f)}`;
}

function Viewfinder({ T, cam, place, mode }) {
  const rec = Math.floor(T * 2) % 2 === 0;
  const bracket = (pos) => <div style={{ position: 'absolute', width: 70, height: 70, borderColor: '#fff', borderStyle: 'solid', borderWidth: 0, ...pos }} />;
  const fg = '#f4f1ea', shadow = '0 2px 6px rgba(0,0,0,.6)';
  return <div style={{ position: 'absolute', inset: 0, fontFamily: PIX, color: fg, textShadow: shadow, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 2px,transparent 2px 5px)', mixBlendMode: 'multiply' }} />
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)' }} />
    {bracket({ left: 60, top: 250, borderTopWidth: 5, borderLeftWidth: 5 })}
    {bracket({ right: 60, top: 250, borderTopWidth: 5, borderRightWidth: 5 })}
    {bracket({ left: 60, top: 1430, borderBottomWidth: 5, borderLeftWidth: 5 })}
    {bracket({ right: 60, top: 1430, borderBottomWidth: 5, borderRightWidth: 5 })}
    <div style={{ position: 'absolute', left: 100, top: 280, display: 'flex', alignItems: 'center', gap: 16, fontSize: 56 }}>
      {mode === 'cctv' ? <span>{cam}</span> : <><span style={{ width: 30, height: 30, borderRadius: 15, background: RED, opacity: rec ? 1 : 0.15, boxShadow: 'none' }} /><span>REC</span></>}
    </div>
    <div style={{ position: 'absolute', right: 100, top: 280, fontSize: 48 }}>{tc(T)}</div>
    <div style={{ position: 'absolute', left: 100, top: 1405, fontSize: 46 }}>{mode === 'cctv' ? '27.06.2027  18:42:07' : 'JUN 27 2027  19:00'}</div>
    <div style={{ position: 'absolute', right: 100, top: 1405, fontSize: 46 }}>{place}</div>
    {mode === 'cctv' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(40,90,60,.18)', mixBlendMode: 'screen' }} />}
  </div>;
}

function Caption({ text, x, y, size, bg, color, style }) {
  return <div style={{ position: 'absolute', left: x, top: y, fontFamily: PIX, fontSize: size, lineHeight: 1,
    padding: '8px 22px 4px', background: bg, color, whiteSpace: 'nowrap', letterSpacing: '0.04em', ...style }}>{text}</div>;
}

function typed(text, T, start, cps) {
  return text.slice(0, clamp(Math.floor((T - start) * cps), 0, text.length));
}

function Flash({ T, at }) {
  const a = M.enter(1, 0, at, at + 0.28)(T) * (T >= at ? 1 : 0);
  return <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: a * 0.85, pointerEvents: 'none' }} />;
}

function Piece() {
  const { T, CUES, authoredTotal } = useComposition();
  const [t] = window.useTweaks(window.TWEAK_DEFAULTS);
  const names = JSON.parse(window.OM_SCENES).map(x => x.name);
  const H0 = CUES.Hook, B = names.includes('Backstage') ? CUES.Backstage : CUES.Reveal, Rv = CUES.Reveal, S = CUES.Songs, I = CUES.Info, C = CUES.CTA, END = authoredTotal;
  const muted = !t.sound;

  // hook captions (0–B): POV types, sentence holds ≥2.5 s
  const pov = typed('POV:', T, H0 + 0.2, 8);
  const hookLine = M.pop(0, 1, H0 + 0.8, H0 + 1.1)(T);
  const hookOut = M.enter(0, 1, B - 0.25, B)(T);
  // backstage caption
  const bsIn = M.pop(0, 1, B + 0.5, B + 0.8)(T);
  const bsOut = M.enter(0, 1, Rv - 0.25, Rv)(T);

  // poster layer
  const posterVis = T >= Rv;
  const wipe = M.draw(100, 0, Rv + 0.1, Rv + 1.0)(T);
  const heroScale = M.enter(1.14, 1, Rv, Rv + 1.6)(T);
  const realPov = M.enter(0, 1, Rv + 0.6, Rv + 1.0)(T);
  const logoIn = M.enter(0, 1, I, I + 0.6)(T);
  const dateIn = M.pop(0, 1, I + 0.5, I + 1.0)(T);
  const stickerIn = M.pop(0, 1, I + 1.4, I + 1.8)(T);
  const tixIn = M.enter(0, 1, C, C + 0.4)(T);
  const full = M.enter(0, 1, C + 0.3, C + 0.9)(T);
  const btnIn = M.pop(0, 1, C + 0.6, C + 1.0)(T);
  const pulse = T > C + 1.0 ? 1 + 0.035 * Math.sin((T - C) * 6) : 1;
  const fadeOut = M.draw(1, 0, END - 0.4, END)(T);
  const posterPush = M.draw(1, 1.04, Rv, I)(T);

  // songs: live clip with stacked titles, each title ≥1.4 s alone before the next
  const gap = (I - S - 1.4) / 3;
  const songs = [['DIE HITS. LIVE.', 0.3, INK, 64], ['ROOFTOP', 0.8, INK, 124], ['UNFORGETTABLE', 0.8 + gap, INK, 124], ['LIKE I LOVE YOU', 0.8 + 2 * gap, RED, 124]];
  const songsOut = M.enter(0, 1, I - 0.3, I)(T);
  const clipLive = T >= S && T < I;

  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: PAPER }}>
    <Music src="assets/audio/rooftop.mp3" from={0} to={S} offset={t.introStart} muted={muted}
      vol={0.4 * M.enter(0, 1, 0, 0.6)(T) * M.draw(1, 0.6, S - 0.4, S)(T)} />
    <Music src="assets/audio/rooftop.mp3" from={S} to={END} offset={t.refrainStart} muted={muted}
      vol={M.enter(0.5, 0.95, S, S + 0.3)(T) * M.draw(1, 0, END - 1.0, END)(T)} />

    <Clip src="assets/clips/clip-01.mp4" from={H0} to={B} offset={t.clip1Start} label="TRAILER-CLIP 01 · Publikum / Bühne" muted={muted} zoom={[1.0, 1.1]} />
    <Clip src="assets/clips/clip-02.mp4" from={B} to={Rv} offset={t.clip2Start} label="TRAILER-CLIP 02 · Backstage / Walk-in" muted={muted} filter="grayscale(1) contrast(1.15) brightness(1.05)" zoom={[1.12, 1.0]} />
    <Clip src="assets/clips/clip-03.mp4" from={S} to={I} offset={t.clip3Start} label="TRAILER-CLIP 03 · Live-Performance" muted={muted} zoom={[1.0, 1.12]} />

    {T < B && <Viewfinder T={T} mode="cam" place="SEEGARTEN" />}
    {T >= B && T < Rv && <Viewfinder T={T} mode="cctv" cam="CAM 02 · BACKSTAGE" place="AMORBACH" />}
    {clipLive && <Viewfinder T={T} mode="cam" place="LIVE" />}

    {posterVis && !clipLive && <div style={{ position: 'absolute', inset: 0 }}>
      <Paper />
      <div style={{ position: 'absolute', inset: 0, opacity: fadeOut, transform: `scale(${posterPush})`, transformOrigin: '540px 860px' }}>
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${wipe}% 0 0)`, transform: `scale(${heroScale})`, transformOrigin: '540px 860px' }}>
          <Region clip={R.hero} />
        </div>
        <Region clip={R.pov} style={{ opacity: realPov }} />
        <Region clip={R.logo} style={{ opacity: logoIn, transform: `translateY(${(1 - logoIn) * -90}px)` }} />
        <Region clip={R.date} style={{ opacity: clamp(dateIn, 0, 1), transform: `scale(${1.25 - 0.25 * dateIn})`, transformOrigin: '540px 1400px' }} />
        <Region clip={R.tix} style={{ opacity: tixIn }} />
        <img src={IMG} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: full }} />
      </div>
    </div>}

    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut }}>
      {T < B && <>
        <div style={{ position: 'absolute', left: 100, top: 560, fontFamily: PIX, fontSize: 300, lineHeight: 0.8, color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,.5)', opacity: 1 - hookOut }}>{pov}</div>
        <Caption text="SONNTAG, 19 UHR." x={100} y={860} size={92} bg={INK} color={PAPER} style={{ opacity: clamp(hookLine, 0, 1) * (1 - hookOut), transform: `scale(${0.7 + 0.3 * hookLine})`, transformOrigin: '0 50%' }} />
        <Caption text="DU IM SEEGARTEN." x={100} y={975} size={92} bg={RED} color={PAPER} style={{ opacity: clamp(M.pop(0, 1, H0 + 1.3, H0 + 1.6)(T), 0, 1) * (1 - hookOut) }} />
      </>}
      {T >= B && T < Rv && <Caption text="ER KOMMT NACH AMORBACH." x={90} y={900} size={84} bg={PAPER} color={INK}
        style={{ opacity: clamp(bsIn, 0, 1) * (1 - bsOut), transform: `scale(${0.7 + 0.3 * bsIn}) rotate(-1.5deg)`, transformOrigin: '0 50%' }} />}
      {clipLive && songs.map(([txt, at, bg, size], i) => {
        const p = M.pop(0, 1, S + at, S + at + 0.35)(T);
        return <Caption key={txt} text={txt} x={90 - songsOut * 120} y={700 + i * 150 + (i ? 0 : 40)} size={size} bg={bg} color={PAPER}
          style={{ opacity: clamp(p, 0, 1) * (1 - songsOut), transform: `scale(${0.6 + 0.4 * p}) rotate(${i % 2 ? 1.5 : -1.5}deg)`, transformOrigin: '0 50%' }} />;
      })}
      {posterVis && !clipLive && t.showSticker && <div style={{ position: 'absolute', left: 765, top: 1130, width: 300, padding: '18px 0 14px', background: RED, color: PAPER, textAlign: 'center',
        fontFamily: SANS, fontWeight: 600, fontSize: 40, lineHeight: 1.05, letterSpacing: '0.04em',
        opacity: clamp(stickerIn, 0, 1), transform: `rotate(-6deg) scale(${stickerIn})` }}>SONNTAG<br />19 UHR<div style={{ fontFamily: PIX, fontSize: 34, marginTop: 6, letterSpacing: '0.06em' }}>FESTIVAL-FINALE</div></div>}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 1600, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        background: INK, color: PAPER, fontFamily: PIX, fontSize: 72, letterSpacing: '0.06em',
        opacity: clamp(btnIn, 0, 1), transform: `scale(${btnIn * pulse})` }}>TICKETS SICHERN <span style={{ color: RED }}>&gt;&gt;</span></div>
    </div>

    <Flash T={T} at={B} />
    <Flash T={T} at={Rv} />
    <Flash T={T} at={S} />
    <Flash T={T} at={I} />
  </div>;
}

function NSReel2() {
  const [t, setTweak] = window.useTweaks(window.TWEAK_DEFAULTS);
  return <>
    <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={PAPER}>
      <Piece />
    </CompositionStage>
    <window.TweaksPanel>
      <window.TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
      <window.TweakToggle label="Ton (Musik + O-Ton)" value={t.sound} onChange={v => setTweak('sound', v)} />
      <window.TweakToggle label="Sticker „Sonntag 19 Uhr“" value={t.showSticker} onChange={v => setTweak('showSticker', v)} />
      <window.TweakSection label="Rooftop (Sek. im Song)" />
      <window.TweakNumber label="Intro ab" value={t.introStart} min={0} max={300} step={0.5} onChange={v => setTweak('introStart', v)} />
      <window.TweakNumber label="Refrain ab" value={t.refrainStart} min={0} max={300} step={0.5} onChange={v => setTweak('refrainStart', v)} />
      <window.TweakSection label="Clip-Startpunkte (Sek. im Trailer)" />
      <window.TweakNumber label="Clip 01" value={t.clip1Start} min={0} max={600} step={0.5} onChange={v => setTweak('clip1Start', v)} />
      <window.TweakNumber label="Clip 02" value={t.clip2Start} min={0} max={600} step={0.5} onChange={v => setTweak('clip2Start', v)} />
      <window.TweakNumber label="Clip 03" value={t.clip3Start} min={0} max={600} step={0.5} onChange={v => setTweak('clip3Start', v)} />
    </window.TweaksPanel>
  </>;
}
window.NSReel2 = NSReel2;
})();
