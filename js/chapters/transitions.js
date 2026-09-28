// Chapter 5: transitions and montage. The program monitor's shader mixes two live shots: a straight cut,
// a dissolve (cross-fade), a fade through black, a wipe, a smash cut, and a montage of short shots joined
// by quick dissolves. Durations are in frames at 24 fps; a one-second dissolve is 24 frames.
// The meanings are the conventions described in film grammar texts (e.g. Bordwell & Thompson, Film Art;
// Karel Reisz & Gavin Millar, The Technique of Film Editing): a dissolve suggests time passing, a fade
// marks the end of a section, a wipe says "meanwhile", a smash cut jolts from quiet to loud.
import { THREE } from '../kit.js';
import {
  makeSet, Shooter, makeMonitor, board, drawTimeline, drawBurnIn, suiteLayout, fitNarrow, panelBg, text, wrap, rrect,
  CAMS, COL, SANS, seqFrom, clipIndex, tc, clamp, FPS,
} from '../edit.js';

export const TR = {
  cut: { name: 'Cut', mode: 0, len: false, means: 'No time passes. The story just carries on.' },
  dissolve: { name: 'Dissolve', mode: 1, len: true, means: 'Time passes, or a thought drifts into a memory.' },
  fade: { name: 'Fade', mode: 2, len: true, means: 'An ending: a day, a chapter, a big jump in time.' },
  wipe: { name: 'Wipe', mode: 3, len: true, means: 'Meanwhile, somewhere else. A playful, old-fashioned link.' },
  smash: { name: 'Smash cut', mode: 0, len: false, means: 'A jolt: from quiet to loud, calm to chaos, often for shock or comedy.' },
  montage: { name: 'Montage', mode: 1, len: false, means: 'Hours or years squeezed into seconds.' },
};
const LATER = { alone: true, hour: 21.6, cups: 5 };
function sequence(s) {
  const L = s.len / FPS;
  if (s.tr === 'montage') {
    const d = 6 / FPS;
    return seqFrom([
      { cam: 'CLOCK', dur: 1.3, src: 2, o: { alone: true, hour: 13.2 } },
      { cam: 'CUB', dur: 1.3, src: 2, o: { alone: true, hour: 14.6, cups: 1 }, tr: { type: 'dissolve', len: d } },
      { cam: 'WINDOW', dur: 1.3, src: 2, o: { alone: true, hour: 17.4 }, tr: { type: 'dissolve', len: d } },
      { cam: 'CUP', dur: 1.3, src: 2, o: { alone: true, hour: 18.6, cups: 3 }, tr: { type: 'dissolve', len: d } },
      { cam: 'CLOCK', dur: 1.3, src: 2, o: { alone: true, hour: 20.1 }, tr: { type: 'dissolve', len: d } },
      { cam: 'WIDE', dur: 1.8, src: 2, o: { alone: true, hour: 21.8, cups: 5 }, tr: { type: 'dissolve', len: d } },
    ]);
  }
  if (s.tr === 'smash') return seqFrom([{ cam: 'CUB', dur: 3.4, src: 2, o: { alone: true, hour: 22.5, cups: 5 } }, { cam: 'DOOR', dur: 2.6, src: 16.1, o: { hour: 9, door: undefined } }]);
  const tr = TR[s.tr].len ? { type: s.tr, len: Math.max(1 / FPS, L) } : null;
  return seqFrom([{ cam: 'WIDE', dur: 3.4, src: 0.4 }, { cam: 'WIDE', dur: 3.2, src: 1.0, o: LATER, tr }]);
}
// Draws a tiny curve of how much of shot A (blue) and shot B (yellow) is on screen through the transition.
function curve(g, x, y, w, h, kind) {
  const A = (k) => (kind === 'dissolve' || kind === 'montage' ? 1 - k : kind === 'fade' ? Math.max(0, 1 - 2 * k) : kind === 'wipe' ? 1 - k : k < 0.5 ? 1 : 0);
  const B = (k) => (kind === 'dissolve' || kind === 'montage' ? k : kind === 'fade' ? Math.max(0, 2 * k - 1) : kind === 'wipe' ? k : k < 0.5 ? 0 : 1);
  [[A, '#7aa2ff'], [B, COL.hot]].forEach(([f, c]) => { g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 40; i++) { const k = i / 40; g.lineTo(x + k * w, y + h - f(k) * h); } g.stroke(); });
}

export default {
  id: 'transitions',
  short: 'Transitions',
  title: 'Transitions: cut, dissolve, fade, wipe',
  subtitle: 'How one shot hands over to the next tells you how much time has passed.',
  view: { pos: [3.0, 3.4, 11.2], target: [3.05, 1.85, 0] },
  learn: `<p>Most joins in a film are plain <b>cuts</b>. The other transitions are rarer, so each one carries a message.</p>
    <p>A <b>dissolve</b> fades one shot out while the next fades in, so for a moment you see both. It usually means <b>time has passed</b>. A <b>fade</b> goes down to black and back up: the end of a day or a chapter. A <b>wipe</b> pushes one picture off with a moving edge, a way of saying “meanwhile”. A <b>smash cut</b> jumps suddenly from something quiet to something loud.</p>
    <p>A <b>montage sequence</b> squeezes a long stretch of time into a few seconds: short shots, often joined by quick dissolves and laid over music. Here, Kabir waits all afternoon and into the night.</p>
    <p>Sound helps sell every transition. A dissolve usually cross-fades the sound too, and a smash cut needs a sudden jump in volume. Transition lengths are counted in <b>frames</b>: at 24 frames a second, a one-second dissolve is 24 frames.</p>
    <p class="tip"><b>Try it:</b> step through the transitions and watch the program monitor. For the dissolve, fade and wipe, drag the length from a flicker (2 frames) to a slow two seconds (48 frames).</p>`,
  terms: [
    { t: 'Dissolve', d: 'One shot fades out as the next fades in, so both are seen at once for a moment.' },
    { t: 'Fade', d: 'The picture goes to black (fade out) or comes up from black (fade in).' },
    { t: 'Wipe', d: 'A moving edge pushes one shot off the screen to reveal the next.' },
    { t: 'Smash cut', d: 'A sudden cut from a calm moment to a loud or shocking one.' },
    { t: 'Montage sequence', d: 'A run of short shots that squeezes a long time or a process into seconds.' },
    { t: 'Frame', d: 'One still picture. Cinema shows 24 a second, so transitions are measured in frames.' },
  ],
  defaults: { tr: 'dissolve', len: 24, play: true, t: 0 },
  controls: [
    { key: 'tr', type: 'seg', label: 'Transition', options: Object.entries(TR).map(([v, o]) => ({ v, label: o.name })) },
    { key: 'len', type: 'range', label: 'Length (dissolve, fade, wipe)', min: 2, max: 48, step: 1, fmt: (v) => `${v} frames = ${(v / FPS).toFixed(2)} s` },
    { key: 'play', type: 'toggle', label: 'Play' },
  ],
  quiz: [
    { q: 'A shot of a sunny café dissolves into the same café at night. What does the dissolve tell us?', options: ['Nothing, it is just decoration', 'Time has passed', 'We are in a dream for sure', 'The camera broke'], answer: 1, why: 'A dissolve is the classic signal that time has passed between the two shots.' },
    { q: 'How many frames long is a two-second dissolve at 24 fps?', options: ['2', '12', '48', '240'], answer: 2, why: '2 seconds × 24 frames a second = 48 frames.' },
    { q: 'What is a montage sequence?', options: ['One very long shot', 'A run of short shots that squeezes a long time into seconds', 'The end credits', 'A kind of camera'], answer: 1, why: 'Montage sequences compress time, like a training montage or a day passing, usually over music.' },
  ],
  reel: [
    { ms: 5200, caption: 'A montage of quick dissolves squeezes a whole evening of waiting into seconds.', set: { tr: 'montage', play: true, t: 0 }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const set = makeSet({ rigs: ['WIDE', 'CUB', 'DOOR'] }); root.add(set.group);
    const shooter = new Shooter(stage, set);
    const prog = makeMonitor(root, shooter, 3.4, 1.9125, { label: 'PROGRAM', col: COL.red });
    const gram = board(root, 2.3, 1.62, 520, 366, () => {}, null); shooter.hide.push(gram.mesh);
    const tl = board(root, 5.6, 1.6, 1024, 292, () => {}, null); shooter.hide.push(tl.mesh);
    const layout = suiteLayout(stage, [
      [gram.mesh, { pos: [4.0, 3.3, 0.2] }, null],
      [prog.group, { pos: [6.95, 3.2, 0.2] }, { pos: [0, 6.25, 0], scale: 1.08 }],
      [tl.mesh, { pos: [5.45, 1.25, 0.7], rx: -0.3 }, { pos: [0, 4.25, 0.25], scale: 0.66, rx: -0.15 }],
    ], this.view, { pos: [0, 4.6, 5.0], target: [0, 3.55, 0] });
    const lSet = stage.label('The set', [0, 2.95, -1.6], set.group);

    const drawGram = (s) => {
      const g = gram.canvas.getContext('2d'), W = 520, H = 366; panelBg(g, W, H);
      text(g, 'THE GRAMMAR OF TRANSITIONS', 18, 32, { font: `600 19px ${SANS}`, col: '#e8eef8' });
      Object.entries(TR).forEach(([k, o], i) => {
        const y = 48 + i * 52, on = k === s.tr;
        if (on) { g.fillStyle = 'rgba(255,209,102,.14)'; rrect(g, 10, y, W - 20, 48, 8); g.fill(); }
        curve(g, 20, y + 8, 60, 32, k);
        text(g, o.name, 96, y + 21, { font: `600 16px ${SANS}`, col: on ? COL.hot : '#fff' });
        wrap(g, o.means, 96, y + 41, 400, 18, { font: `13px ${SANS}`, col: 'rgba(255,255,255,.7)' });
      });
      text(g, 'blue: outgoing shot   yellow: incoming', 18, H - 8, { font: `12px ${SANS}`, col: COL.dim });
      gram.tex.needsUpdate = true;
    };

    let gKey = '', tlKey = '', info = {};
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const seq = sequence(s), dur = seq[seq.length - 1].b;
        if (s.play) s.t = (s.t + dt) % dur; else s.t = clamp(s.t, 0, dur - 0.01);
        const lay = layout();
        if (gKey !== s.tr) { gKey = s.tr; drawGram(s); }
        const T = s.t;
        // Is the playhead inside a transition?
        let j = -1, k = 0;
        for (let q = 1; q < seq.length; q++) { const tr = seq[q].tr; if (tr && Math.abs(T - seq[q].a) < tr.len / 2) { j = q; k = (T - (seq[q].a - tr.len / 2)) / tr.len; break; } }
        const at = (c) => ({ spec: CAMS[c.cam], t: clamp(c.src + (T - c.a), 0, 18), o: c.o || {} });
        let i = clipIndex(seq, T), c = seq[i], flash = 0;
        if (j > 0) {
          const A = at(seq[j - 1]), B = at(seq[j]);
          shooter.shoot(prog.rtA, A.spec, A.t, A.o); shooter.shoot(prog.rtB, B.spec, B.t, B.o);
          prog.set({ uMode: { dissolve: 1, fade: 2, wipe: 3 }[seq[j].tr.type], uMix: k });
        } else {
          const A = at(c); shooter.shoot(prog.rtA, A.spec, A.t, A.o); prog.set({ uMode: 0, uMix: 0 });
        }
        if (s.tr === 'smash' && i === 1) flash = Math.max(0, 1 - (T - c.a) / 0.12) * 0.6;
        prog.set({ uFlash: flash });
        Object.entries(set.rigs).forEach(([key, r]) => r.tally(key === c.cam ? 'live' : ''));
        const f = Math.round(T * 24), inTr = j > 0;
        const note = s.tr === 'smash' && i === 1 && T - c.a < 0.8 ? '[ DOOR BANGS OPEN ]' : inTr ? `${TR[s.tr].name.toUpperCase()} ${Math.round(k * 100)}%` : '';
        prog.overlay(`${c.cam}|${f}|${note}`, (x, W, H) => drawBurnIn(x, W, H, { tag: `${i + 1}  ${CAMS[c.cam].short}`, tagCol: CAMS[c.cam].col, tcode: tc(T), note }));
        const tk = `${Math.round(T * 30)}|${s.tr}|${s.len}`;
        if (tk !== tlKey) {
          tlKey = tk;
          const audio = s.tr === 'smash' ? [{ a: 0, b: 3.4, label: 'quiet room tone', col: '#6b7a90' }, { a: 3.4, b: 4.3, label: 'BANG', col: COL.bad }, { a: 4.3, b: 6, label: 'street noise', col: '#c9a86b' }]
            : s.tr === 'montage' ? [{ a: 0, b: dur, label: 'music', col: '#ff8fc8' }]
              : [{ a: 0, b: 3.4 + (seq[1].tr?.len || 0) / 2, label: 'café chatter', col: '#6b9a90' }, { a: 3.4 - (seq[1].tr?.len || 0) / 2, b: dur, label: 'night crickets', col: '#8a7ab0' }];
          drawTimeline(tl.canvas.getContext('2d'), 1024, 292, seq.map((q) => ({ ...q, label: `${CAMS[q.cam].short}${q.o?.hour ? ' · ' + Math.floor(q.o.hour) + ':00' : ''}` })), { dur, t: T, audio, title: `TRANSITION · ${TR[s.tr].name.toUpperCase()}` });
          tl.tex.needsUpdate = true;
        }
        info = { i, c, inTr, k, seq };
        fitNarrow(stage, [lSet], -0.05);
      },
      readout(s) {
        if (!info.seq) return '';
        const o = TR[s.tr];
        const len = o.len ? `${s.len} frames = ${(s.len / FPS).toFixed(2)} s` : s.tr === 'montage' ? `${info.seq.length} shots, 6-frame dissolves` : '0 frames: instant';
        return `<div class="big">${o.name}</div>
          <div class="row"><span>Length</span><b>${len}</b></div>
          <div class="row"><span>It tells you</span><b style="max-width:230px;text-align:right">${o.means}</b></div>
          <div class="row"><span>Now</span><b>${info.inTr ? `mid-transition, ${Math.round(info.k * 100)}%` : `shot ${info.i + 1}`}</b></div>`;
      },
      dispose() { shooter.dispose(); stage.setShift(0, 0); },
    };
  },
};
