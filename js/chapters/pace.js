// Chapter 4: pace, rhythm, and J- and L-cuts.
// Pace: the same 18-second scene re-cut to a chosen average shot length (ASL = running time ÷ number of
// shots). Each new shot goes to whoever is talking; if that repeats the last set-up, it cuts to the
// listener's reaction or the wide instead.
// ASL data (chart): James E. Cutting, "The evolution of pace in popular movies", Cognitive Research:
// Principles and Implications 1:30 (2016): mean shot duration 7.5 s for silent films (1915–1925), 10.5 s
// for early sound films (1930–1955), 7.0 s (1960–1985) and 4.3 s (1990–2015). David Bordwell,
// "Intensified Continuity", Film Quarterly 55(3), 2002: most Hollywood films of 1930–1960 had ASLs of
// 8–11 s; by 2000 many were 3–6 s, and many action films 2–4 s.
// The "feel" labels are rules of thumb from those studies (faster cutting reads as more urgent), not a measurement.
// J-cut and L-cut: a split edit in which the sound cut and the picture cut happen at different times.
import { THREE } from '../kit.js';
import {
  makeSet, Shooter, makeMonitor, board, drawTimeline, drawBurnIn, suiteLayout, fitNarrow, quietSlider, panelBg, text, rrect,
  CAMS, LINES, NAMES, DUR, COL, SANS, clipIndex, lineAt, tc, clamp, realTime, FPS,
} from '../edit.js';

export const ASL_DATA = [
  { label: 'Silent films', years: '1915–25', v: 7.5, src: 'Cutting 2016' },
  { label: 'Early sound', years: '1930–55', v: 10.5, src: 'Cutting 2016' },
  { label: 'Mid-century', years: '1960–85', v: 7.0, src: 'Cutting 2016' },
  { label: 'Recent films', years: '1990–2015', v: 4.3, src: 'Cutting 2016' },
  { label: 'Action, c. 2000', years: 'many', v: 3, lo: 2, hi: 4, src: 'Bordwell 2002' },
];
export const feel = (a) => (a >= 9 ? 'calm, patient, watchful' : a >= 6 ? 'classic and steady' : a >= 3.8 ? 'modern and lively' : a >= 2.4 ? 'urgent, tense' : 'frantic, breathless');

// Re-cut the scene to an average shot length.
export function pacedEdit(target) {
  const n = Math.max(1, Math.round(DUR / target)), len = DUR / n, cuts = [], cams = [];
  for (let i = 0; i < n; i++) {
    const a = i * len, b = a + len, mid = (a + b) / 2;
    if (i) cuts.push(a);
    let l = lineAt(mid) || LINES.find((q) => q.t0 >= a && q.t0 < b);
    let cam = mid > 13.2 ? 'WIDE' : l ? (l.who === 'A' ? 'CUA' : 'CUB') : 'WIDE';
    if (n <= 2) cam = 'WIDE';
    const prev = cams[cams.length - 1];
    if (cam === prev) cam = cam === 'WIDE' ? 'CUB' : cam === 'CUA' ? (i % 3 ? 'CUB' : 'WIDE') : (i % 3 ? 'CUA' : 'WIDE');
    cams.push(cam);
  }
  return realTime(cuts, cams);
}
// Split edits: picture cuts happen shift seconds after (J) or before (L) each change of speaker.
export function splitEdit(shift) {
  const starts = [3.3, 6.7, 9.6], who = ['CUA', 'CUB', 'CUA', 'CUB'];
  const cuts = starts.map((t) => clamp(t + shift, 0.5, 13)), cams = [...who];
  cuts.push(13.4); cams.push('WIDE');
  return realTime(cuts, cams);
}

export default {
  id: 'pace',
  short: 'Pace & rhythm',
  title: 'Pace, rhythm, and sound that leads',
  subtitle: 'Cut the same scene fast or slow, and let the sound arrive before the picture.',
  view: { pos: [3.0, 3.4, 11.2], target: [3.05, 1.85, 0] },
  learn: `<p>How long each shot lasts sets the <b>pace</b> of a film. Film scholars measure it as the <b>average shot length</b> (ASL): running time divided by the number of shots.</p>
    <p>Films have sped up. James Cutting’s study of Hollywood films found an average of about <b>10.5 seconds</b> a shot in the early sound era (1930 to 1955), falling to about <b>4.3 seconds</b> for films from 1990 to 2015. David Bordwell found many action films cut every <b>2 to 4 seconds</b>. Faster cutting feels more urgent. Longer shots let you watch and think.</p>
    <p><b>Rhythm</b> is more than speed. Editors vary shot lengths the way a drummer varies beats, and they cut on the natural pauses and breaths of the actors.</p>
    <p>Picture and sound don’t have to cut at the same moment. In a <b>J-cut</b> the next shot’s sound starts first: we hear Kabir before we see him. In an <b>L-cut</b> the sound carries on over the next picture: we still hear Asha while we watch Kabir listen. These <b>split edits</b> make conversations flow. More on dialogue, effects and music in FilmSoundClear.</p>
    <p class="tip"><b>Try it:</b> drag the average shot length from slow to fast and watch the readout. Then switch to split edits and slide between an L-cut and a J-cut. Watch the gap open between the picture cut and the dialogue on the timeline.</p>`,
  terms: [
    { t: 'Pace', d: 'How quickly shots change, which sets how fast a film feels.' },
    { t: 'Average shot length (ASL)', d: 'Running time divided by the number of shots.' },
    { t: 'Rhythm', d: 'The pattern of long and short shots, and where the cuts fall against speech and movement.' },
    { t: 'J-cut', d: 'A split edit where the next shot’s sound starts before its picture.' },
    { t: 'L-cut', d: 'A split edit where a shot’s sound carries on over the next picture.' },
    { t: 'Split edit', d: 'Any cut where picture and sound change at different moments.' },
  ],
  defaults: { mode: 'pace', asl: 4.5, shift: 0.6, play: true, t: 0 },
  onChange(s, key) { if (key === 'asl') s.mode = 'pace'; if (key === 'shift') s.mode = 'split'; },
  controls: [
    { key: 'mode', type: 'seg', label: 'Edit', options: [{ v: 'pace', label: 'Pace' }, { v: 'split', label: 'Split edits (J / L)' }] },
    { key: 'asl', type: 'log', label: 'Average shot length', min: 1.5, max: 18, ends: ['1.5 s, frantic', '18 s, one take'], fmt: (v) => `${v.toFixed(1)} s` },
    { key: 'shift', type: 'range', label: 'Picture cut vs new speaker', min: -1.2, max: 1.2, step: 1 / 24, ends: ['L-cut: picture first', 'J-cut: sound first'], fmt: (v) => (Math.abs(v) < 0.05 ? 'together' : `${v > 0 ? 'sound leads' : 'picture leads'} by ${Math.round(Math.abs(v) * FPS)} frames`) },
    { key: 'play', type: 'toggle', label: 'Play' },
    { key: 't', type: 'range', label: 'Playhead', min: 0, max: DUR, step: 0.05, fmt: (v) => `${v.toFixed(1)} s` },
  ],
  quiz: [
    { q: 'A 100-minute film has 1,500 shots. What is its average shot length?', options: ['0.25 s', '4 s', '15 s', '40 s'], answer: 1, why: '100 minutes is 6,000 seconds. 6,000 ÷ 1,500 = 4 seconds a shot.' },
    { q: 'We hear Kabir start to speak while we still see Asha, then cut to Kabir. What is that?', options: ['A jump cut', 'A J-cut', 'A match cut', 'A fade'], answer: 1, why: 'The next shot’s sound starts before its picture. On the timeline the audio edit sits earlier, making a J shape.' },
    { q: 'How has the pace of Hollywood films changed since the 1930s?', options: ['Shots got longer', 'Shots got shorter, from about 10 s to about 4 s on average', 'No change', 'They stopped cutting'], answer: 1, why: 'Cutting’s measurements show average shots falling from about 10.5 s (1930 to 1955) to about 4.3 s (1990 to 2015).' },
  ],
  reel: [
    { ms: 5600, caption: 'The same scene, cut faster and faster: from calm long takes to a frantic 1.5 seconds a shot.', set: { mode: 'pace', play: true, t: 0.5 }, anim: { asl: [14, 1.6, true] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const set = makeSet({ rigs: ['WIDE', 'CUA', 'CUB'] }); root.add(set.group);
    const shooter = new Shooter(stage, set);
    const prog = makeMonitor(root, shooter, 3.4, 1.9125, { label: 'PROGRAM', col: COL.red });
    const chart = board(root, 2.3, 1.62, 520, 366, () => {}, null); shooter.hide.push(chart.mesh);
    const tl = board(root, 5.6, 1.6, 1024, 292, () => {}, null); shooter.hide.push(tl.mesh);
    const layout = suiteLayout(stage, [
      [chart.mesh, { pos: [4.0, 3.3, 0.2] }, null],
      [prog.group, { pos: [6.95, 3.2, 0.2] }, { pos: [0, 6.25, 0], scale: 1.08 }],
      [tl.mesh, { pos: [5.45, 1.25, 0.7], rx: -0.3 }, { pos: [0, 4.25, 0.25], scale: 0.66, rx: -0.15 }],
    ], this.view, { pos: [0, 4.6, 5.0], target: [0, 3.55, 0] });
    const lSet = stage.label('The set', [0, 2.95, -1.6], set.group);

    const drawChart = (s) => {
      const g = chart.canvas.getContext('2d'), W = 520, H = 366; panelBg(g, W, H);
      text(g, 'AVERAGE SHOT LENGTH', 18, 32, { font: `600 19px ${SANS}`, col: '#e8eef8' });
      text(g, 'Cutting 2016 (Hollywood) · Bordwell 2002', 18, 55, { font: `14px ${SANS}`, col: COL.soft });
      const x0 = 180, x1 = 490, max = 12, X = (v) => x0 + (Math.min(v, max) / max) * (x1 - x0);
      ASL_DATA.forEach((d, i) => {
        const y = 78 + i * 46;
        text(g, d.label, 18, y + 18, { font: `600 15px ${SANS}`, col: '#fff' });
        text(g, d.years, 18, y + 36, { font: `13px ${SANS}`, col: COL.dim });
        g.fillStyle = 'rgba(255,255,255,.08)'; rrect(g, x0, y + 6, x1 - x0, 22, 5); g.fill();
        g.fillStyle = i === 4 ? COL.bad : '#7aa2ff';
        if (d.lo) { rrect(g, X(d.lo), y + 6, X(d.hi) - X(d.lo), 22, 5); g.fill(); } else { rrect(g, x0, y + 6, X(d.v) - x0, 22, 5); g.fill(); }
        text(g, d.lo ? `${d.lo}–${d.hi} s` : `${d.v} s`, d.lo ? X(d.hi) + 8 : X(d.v) + 8, y + 23, { font: `600 14px ${SANS}`, col: '#fff' });
      });
      // Your edit
      const a = s.info?.asl ?? s.asl, xx = X(a);
      g.strokeStyle = COL.hot; g.lineWidth = 3; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(xx, 70); g.lineTo(xx, 312); g.stroke(); g.setLineDash([]);
      text(g, `your edit: ${a.toFixed(1)} s${a > max ? ' →' : ''}`, clamp(xx - 60, 150, 390), 336, { font: `600 16px ${SANS}`, col: COL.hot });
      [0, 4, 8, 12].forEach((v) => text(g, `${v}s`, X(v) - 8, 356, { font: `12px ${SANS}`, col: COL.dim }));
      chart.tex.needsUpdate = true;
    };

    let seq = null, seqKey = '', tlKey = '', chartKey = '', lastQ = 0, info = {};
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        const sk = s.mode === 'pace' ? `p${Math.round(DUR / s.asl)}` : `s${s.shift.toFixed(3)}`;
        if (sk !== seqKey) { seqKey = sk; seq = s.mode === 'pace' ? pacedEdit(s.asl) : splitEdit(s.shift); }
        if (s.play) { s.t = (s.t + dt) % DUR; if (time - lastQ > 0.12) { lastQ = time; quietSlider('Playhead', s.t); } }
        const lay = layout();
        const i = clipIndex(seq, s.t), c = seq[i], srcT = c.src + (s.t - c.a);
        shooter.shoot(prog.rtA, CAMS[c.cam], srcT);
        Object.entries(set.rigs).forEach(([k, r]) => r.tally(k === c.cam ? 'live' : ''));
        const l = lineAt(srcT), f = Math.round(s.t * 24);
        // Who we hear vs who we see
        const seen = c.cam === 'CUA' ? 'A' : c.cam === 'CUB' ? 'B' : 'both';
        const split = l && seen !== 'both' && seen !== l.who;
        prog.overlay(`${c.cam}|${f}|${l?.text}|${split}`, (x, W, H) => drawBurnIn(x, W, H, { tag: `${i + 1}  ${CAMS[c.cam].short}`, tagCol: CAMS[c.cam].col, tcode: tc(s.t), sub: l ? { name: NAMES[l.who] + (split ? ' (off screen)' : ''), text: l.text, col: l.who === 'A' ? '#ffc2b8' : '#b9f5dc' } : null }));
        const st = { asl: DUR / seq.length, cuts: seq.length - 1 };
        info = { c, i, l, seen, split, st };
        s.info = st;
        const ck = `${st.asl.toFixed(2)}`;
        if (ck !== chartKey) { chartKey = ck; drawChart(s); }
        const k = `${Math.round(s.t * 40)}|${seqKey}`;
        if (k !== tlKey) {
          tlKey = k;
          const marks = s.mode === 'split' ? [3.3, 6.7, 9.6].map((t, j) => ({ t, col: COL.hot, label: j === 0 ? 'new speaker' : '' })) : [];
          drawTimeline(tl.canvas.getContext('2d'), 1024, 292, seq, { dur: DUR, t: s.t, audio: LINES.map((q) => ({ who: q.who, a: q.t0, b: q.t1 })), marks, title: s.mode === 'pace' ? `PACE · ${seq.length} SHOTS` : 'SPLIT EDITS' });
          tl.tex.needsUpdate = true;
        }
        fitNarrow(stage, [lSet], -0.05);
      },
      readout(s) {
        if (!info.st) return '';
        const { st, l, seen, split } = info;
        if (s.mode === 'pace') {
          return `<div class="big">Feels ${feel(st.asl)}</div>
            <div class="row"><span>Average shot</span><b>${st.asl.toFixed(1)} s</b></div>
            <div class="row"><span>Cuts a minute</span><b>${Math.round((st.cuts / DUR) * 60)}</b></div>
            <div class="row"><span>Shots in a 2-hour film at this pace</span><b>${Math.round(7200 / st.asl).toLocaleString('en-IN')}</b></div>`;
        }
        const fr = Math.round(Math.abs(s.shift) * FPS), kind = Math.abs(s.shift) < 0.05 ? 'Straight cut' : s.shift > 0 ? 'J-cut: sound leads' : 'L-cut: picture leads';
        return `<div class="big">${kind}</div>
          <div class="row"><span>Offset</span><b>${fr} frames (${Math.abs(s.shift).toFixed(2)} s)</b></div>
          <div class="row"><span>We hear</span><b>${l ? NAMES[l.who] : 'a pause'}</b></div>
          <div class="row"><span>We see</span><b class="${split ? 'ok' : ''}">${seen === 'both' ? 'both of them' : NAMES[seen]}${split ? ', listening' : ''}</b></div>`;
      },
      dispose() { shooter.dispose(); stage.setShift(0, 0); },
    };
  },
};
