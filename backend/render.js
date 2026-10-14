// Rendert ein Ad aus der Schnittliste des Editors mit ffmpeg (Clips, Übergänge, Texte, Musik).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { db, MEDIA_DIR, RENDER_DIR } from './db.js';

const XF = { cut: ['fade', 0.04], flash: ['fadewhite', 0.34], whipR: ['slideleft', 0.22], whipL: ['slideright', 0.22], xfade: ['fade', 0.5], zoom: ['zoomin', 0.4], wipe: ['wiperight', 0.4], glitch: ['pixelize', 0.3], dip: ['fadeblack', 0.5] };
const ENC = {
  mp4: ['-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
  mov: ['-c:v', 'prores_ks', '-profile:v', '2', '-c:a', 'pcm_s16le'],
  webm: ['-c:v', 'libvpx-vp9', '-b:v', '6M', '-c:a', 'libopus'],
};
const resolve = src => {
  const m = String(src).match(/\/media\/([\w-]+)/); if (m) { const row = db.prepare('SELECT file FROM media WHERE id=?').get(m[1]); if (row) return path.join(MEDIA_DIR, row.file); }
  return path.resolve(process.env.ASSET_ROOT || '..', String(src).replace(/^\.?\//, ''));
};
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\u2019").replace(/:/g, '\\:').replace(/%/g, '\\%');
const hex = c => (!c || c === 'transparent') ? null : c.replace('#', '0x');

export function buildArgs(spec, out) {
  const { w, h, clips, texts = [], audio = [], format = 'mp4' } = spec, args = ['-y'], f = [];
  if (format === 'jpg') {
    args.push('-i', resolve(spec.bg || clips[0]?.src));
    f.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[v0]`);
  } else clips.forEach((c, i) => {
    const next = clips[i + 1], td = next ? (XF[next.trans] || XF.cut)[1] : 0, sp = c.speed || 1, len = (c.dur + td) * sp;
    if (c.image) args.push('-loop', '1', '-t', String(c.dur + td), '-i', resolve(c.src)); else args.push('-ss', String(c.in || 0), '-t', String(len), '-i', resolve(c.src));
    f.push(`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30${c.image ? '' : `,setpts=PTS/${sp}`}[c${i}]`);
  });
  let last = format === 'jpg' ? 'v0' : 'c0', t = clips[0]?.dur || 0;
  if (format !== 'jpg') for (let i = 1; i < clips.length; i++) {
    const [x, td] = XF[clips[i].trans] || XF.cut; f.push(`[${last}][c${i}]xfade=transition=${x}:duration=${td}:offset=${t.toFixed(3)}[x${i}]`); last = 'x' + i; t += clips[i].dur;
  }
  texts.forEach((tb, i) => {
    const fs = Math.round(tb.size / 100 * Math.min(w, h)), x = tb.anchor === 'center' ? `(w*${tb.x / 100})-text_w/2` : `w*${tb.x / 100}`, bg = hex(tb.bg);
    const en = format === 'jpg' ? '' : `:enable='between(t,${tb.start},${tb.end})'`;
    f.push(`[${last}]drawtext=text='${esc(tb.text)}':font='${esc(tb.font || 'Sans')}':fontsize=${fs}:fontcolor=${hex(tb.color) || 'white'}:x=${x}:y=h*${tb.y / 100}-text_h/2${bg ? `:box=1:boxcolor=${bg}:boxborderw=${Math.round(fs * 0.2)}` : ':shadowcolor=black@0.5:shadowx=2:shadowy=3'}${en}[t${i}]`);
    last = 't' + i;
  });
  if (spec.watermark) { const fs = Math.round(Math.min(w, h) * 0.028); f.push(`[${last}]drawtext=text='Made with Ad Studio':font='Sans':fontsize=${fs}:fontcolor=white@0.85:box=1:boxcolor=black@0.5:boxborderw=${Math.round(fs * 0.4)}:x=w-text_w-${fs}:y=h-text_h-${fs}[wm]`); last = 'wm'; }
  const vIn = args.filter(a => a === '-i').length;
  if (format !== 'jpg' && audio.length) {
    audio.forEach((a, i) => {
      const n = vIn + i, len = a.len ?? spec.total; args.push('-ss', String(a.offset || 0), '-t', String(len), '-i', resolve(a.src));
      f.push(`[${n}:a]volume=${a.vol ?? 1},afade=t=in:d=${a.fadeIn || 0.01},afade=t=out:st=${Math.max(0, len - (a.fadeOut || 0.01))}:d=${a.fadeOut || 0.01},adelay=${Math.round((a.at || 0) * 1000)}:all=1[a${i}]`);
    });
    f.push(`${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0,alimiter=limit=0.95[aout]`);
  }
  args.push('-filter_complex', f.join(';'), '-map', `[${last}]`);
  if (format === 'jpg') args.push('-frames:v', '1', '-q:v', '2');
  else { if (audio.length) args.push('-map', '[aout]'); args.push('-t', String(spec.total), ...(ENC[format] || ENC.mp4)); }
  if (format === 'gif') { args.splice(args.indexOf('-filter_complex') + 1, 1, f.join(';') + `;[${last}]fps=15,scale=480:-1,split[g1][g2];[g1]palettegen[p];[g2][p]paletteuse[gif]`); args[args.indexOf('-map') + 1] = '[gif]'; }
  args.push(out); return args;
}

export function render(jobId, spec) {
  const ext = spec.format === 'mov' ? 'mov' : spec.format || 'mp4', file = `${jobId}.${ext}`, out = path.join(RENDER_DIR, file);
  db.prepare('UPDATE renders SET status=?, file=? WHERE id=?').run('rendering', file, jobId);
  return new Promise(res => {
    const p = spawn(process.env.FFMPEG || 'ffmpeg', buildArgs(spec, out)); let err = '';
    p.stderr.on('data', d => { err = (err + d).slice(-4000); });
    p.on('close', code => {
      if (code === 0) db.prepare('UPDATE renders SET status=? WHERE id=?').run('done', jobId);
      else db.prepare('UPDATE renders SET status=?, error=? WHERE id=?').run('error', err.split('\n').slice(-6).join('\n'), jobId);
      res({ ok: code === 0, out });
    });
  });
}
