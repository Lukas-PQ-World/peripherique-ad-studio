(function(){
const { useComposition, animate, Easing, clamp, CompositionStage } = window;
const W = 1080, H = 1920, IMG = 'assets/ns-story.jpg';
const INK = '#2b2a29', PAPER = '#ede6d8', RED = '#d2161b';
const PIX = "'VT323', monospace", SANS = "'Jost', sans-serif";

const M = {
  enter: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutCubic }),
  pop: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeOutBack }),
  draw: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeInOutCubic }),
};

// regions of the key visual (1080x1920 px)
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

function typed(text, T, start, cps) {
  const n = clamp(Math.floor((T - start) * cps), 0, text.length);
  return text.slice(0, n);
}

function Label({ text, x, y, size, bg, color, style }) {
  return <div style={{
    position: 'absolute', left: x, top: y, fontFamily: PIX, fontSize: size, lineHeight: 1,
    padding: '6px 18px 2px', background: bg, color, whiteSpace: 'nowrap', letterSpacing: '0.04em', ...style,
  }}>{text}</div>;
}

function Piece() {
  const { T, CUES, authoredTotal } = useComposition();
  const [t] = window.useTweaks(window.TWEAK_DEFAULTS);
  const Rv = CUES.Reveal, S = CUES.Songs, I = CUES.Info, C = CUES.CTA, END = authoredTotal;

  // camera
  const push = M.draw(1, 1.04, Rv, S)(T);
  const zoomIn = M.draw(0, 1, S, S + 0.9)(T) - M.draw(0, 1, I - 0.7, I + 0.1)(T);
  const camScale = push + zoomIn * 0.55;
  const fadeOut = M.draw(1, 0, END - 0.4, END)(T);

  // hook
  const pov = typed('POV:', T, 0.15, 7);
  const povMove = M.draw(0, 1, Rv - 0.35, Rv + 0.35)(T);
  const povX = 140 + (89 - 140) * povMove, povY = 560 + (452 - 560) * povMove;
  const povScale = 1 - povMove * 0.66;
  const povOpacity = 1 - M.enter(0, 1, Rv + 0.1, Rv + 0.4)(T);
  const lines = [['SONNTAGABEND.', 0.8], ['SEEGARTEN AMORBACH.', 1.35], ['SONNENUNTERGANG.', 2.05]];
  const linesOut = M.enter(0, 1, Rv - 0.2, Rv + 0.3)(T);
  const cursorOn = Math.floor(T * 3) % 2 === 0 && T < Rv;

  // reveal
  const wipe = M.draw(100, 0, Rv, Rv + 0.9)(T);
  const heroScale = M.enter(1.14, 1, Rv, Rv + 1.4)(T);
  const realPov = M.enter(0, 1, Rv + 0.05, Rv + 0.4)(T);

  // songs
  const songs = [['DIE HITS. LIVE.', 0.5, INK, 64], ['ROOFTOP', 1.0, INK, 120], ['UNFORGETTABLE', 1.5, INK, 120], ['LIKE I LOVE YOU', 2.0, RED, 120]];
  const songsOut = M.enter(0, 1, I - 0.6, I - 0.2)(T);

  // info
  const logoIn = M.enter(0, 1, I, I + 0.6)(T);
  const dateIn = M.pop(0, 1, I + 0.4, I + 0.9)(T);
  const stickerIn = M.pop(0, 1, I + 1.1, I + 1.5)(T);

  // cta
  const tixIn = M.enter(0, 1, C, C + 0.4)(T);
  const full = M.enter(0, 1, C + 0.3, C + 0.9)(T);
  const btnIn = M.pop(0, 1, C + 0.5, C + 0.9)(T);
  const pulse = T > C + 0.9 ? 1 + 0.035 * Math.sin((T - C) * 7) : 1;

  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: PAPER }}>
    <Paper />
    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut, transform: `scale(${camScale})`, transformOrigin: '800px 720px' }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${wipe}% 0 0)`, transform: `scale(${heroScale})`, transformOrigin: '540px 860px' }}>
        <Region clip={R.hero} />
      </div>
      <Region clip={R.pov} style={{ opacity: realPov }} />
      <Region clip={R.logo} style={{ opacity: logoIn, transform: `translateY(${(1 - logoIn) * -90}px)` }} />
      <Region clip={R.date} style={{ opacity: clamp(dateIn, 0, 1), transform: `scale(${1.25 - 0.25 * dateIn})`, transformOrigin: '540px 1400px' }} />
      <Region clip={R.tix} style={{ opacity: tixIn }} />
      <img src={IMG} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: full }} />
    </div>

    <div style={{ position: 'absolute', inset: 0, opacity: fadeOut }}>
      <div style={{ position: 'absolute', left: povX, top: povY, transform: `scale(${povScale})`, transformOrigin: '0 0', opacity: povOpacity,
        fontFamily: PIX, fontSize: 340, lineHeight: 0.8, color: INK }}>{pov}<span style={{ opacity: cursorOn && pov.length === 4 ? 1 : 0 }}>_</span></div>
      {lines.map(([txt, at], i) => {
        const s = typed(txt, T, at, 18);
        return s ? <Label key={i} text={s} x={140 - linesOut * 160} y={900 + i * 120} size={84} bg={INK} color={PAPER}
          style={{ opacity: 1 - linesOut }} /> : null;
      })}
      {songs.map(([txt, at, bg, size], i) => {
        const p = M.pop(0, 1, S + at, S + at + 0.35)(T);
        return <Label key={txt} text={txt} x={70 - songsOut * 120} y={1060 + i * 135 - (i ? 0 : -40)} size={size} bg={bg} color={PAPER}
          style={{ opacity: clamp(p, 0, 1) * (1 - songsOut), transform: `scale(${0.6 + 0.4 * p}) rotate(${i % 2 ? 1.5 : -1.5}deg)`, transformOrigin: '0 50%' }} />;
      })}
      {t.showSticker && <div style={{ position: 'absolute', left: 765, top: 1130, width: 300, padding: '18px 0 14px', background: RED, color: PAPER, textAlign: 'center',
        fontFamily: SANS, fontWeight: 600, fontSize: 40, lineHeight: 1.05, letterSpacing: '0.04em',
        opacity: clamp(stickerIn, 0, 1), transform: `rotate(-6deg) scale(${stickerIn})` }}>SONNTAG<br />19 UHR<div style={{ fontFamily: PIX, fontSize: 34, marginTop: 6, letterSpacing: '0.06em' }}>FESTIVAL-FINALE</div></div>}
      <div style={{ position: 'absolute', left: 140, right: 140, top: 1600, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        background: INK, color: PAPER, fontFamily: PIX, fontSize: 72, letterSpacing: '0.06em',
        opacity: clamp(btnIn, 0, 1), transform: `scale(${btnIn * pulse})` }}>TICKETS SICHERN <span style={{ color: RED }}>&gt;&gt;</span></div>
    </div>
  </div>;
}

function NSReel() {
  const [t, setTweak] = window.useTweaks(window.TWEAK_DEFAULTS);
  return <>
    <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={PAPER}>
      <Piece />
    </CompositionStage>
    <window.TweaksPanel>
      <window.TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
      <window.TweakToggle label="Sticker „Sonntag 19 Uhr“" value={t.showSticker} onChange={v => setTweak('showSticker', v)} />
    </window.TweaksPanel>
  </>;
}
window.NSReel = NSReel;
})();
