// Chapter 2: continuity editing. Five classic ways to make a cut invisible (or, on purpose, visible):
//  - cut on action: the door opening carries across the cut; a mismatch slider shifts the incoming
//    shot's source time so the action repeats or skips (door angle measured from the set's pose);
//  - eyeline match: Asha looks up, cut to what she sees; the readout measures how far her gaze
//    (eye → nose direction of the mannequin's head) misses the clock;
//  - match cut: a round cup seen from above cut to a round clock face; the readout projects both circles
//    through their cameras and reports how much of the two circles overlap on screen (intersection / union);
//  - the 180-degree rule: a close-up of Asha then one of Kabir, from the safe side or across the line;
//    facing is measured by projecting each head's eye and nose through the camera;
//  - jump cuts: the same wide shot with time removed; the 30-degree rule is a common guideline
//    (e.g. Bordwell & Thompson, Film Art) that a new angle should differ by at least about 30°.
// Walter Murch's "Rule of Six" (In the Blink of an Eye, 1995; 2nd ed. 2001) weights what a cut should
// respect: emotion 51%, story 23%, rhythm 10%, eye-trace 7%, two-dimensional plane of the screen 5%,
// three-dimensional space of action 4%.
import { THREE } from '../kit.js';
import {
  makeSet, Shooter, makeMonitor, board, drawTimeline, drawBurnIn, suiteLayout, fitNarrow, quietSlider, panelBg, text, rrect,
  CAMS, NAMES, COL, SANS, seqFrom, clipIndex, lineAt, tc, doorAngle, camSwing, screenFacing, clamp, D2R, vfov, FPS,
} from '../edit.js';

const MODES = {
  action: 'Cut on action',
  eyeline: 'Eyeline match',
  match: 'Match cut',
  line: '180° rule',
  jump: 'Jump cut',
};
export const MURCH = [
  { k: 'Emotion', v: 51 }, { k: 'Story', v: 23 }, { k: 'Rhythm', v: 10 },
  { k: 'Eye-trace', v: 7 }, { k: '2D plane of the screen', v: 5 }, { k: '3D space of action', v: 4 },
];
const HOT = { action: [2, 3], eyeline: [3, 5], match: [3, 4], line: [4, 5], jump: [5, 2] };

function matchCam(k) {
  const C = [-0.15, 2.15, -1.64];
  return { name: 'The clock, straight on', short: 'CU CLOCK', pos: [C[0] + 0.25 * k, C[1] - 0.1 * k, C[2] + 2.045], target: [C[0] + 0.25 * k, C[1] + 0.12 * k, C[2]], f: 50 - 24 * k, col: COL.hot, roll: 'D003' };
}
function sequence(s) {
  switch (s.mode) {
    case 'action': return seqFrom([{ cam: 'WIDE', dur: 2.6, src: 14.1 }, { cam: 'DOOR', dur: 2.4, src: 16.7 + s.mis }]);
    case 'eyeline': return seqFrom([{ cam: 'CUA', dur: 2.4, src: 3.6, o: { gaze: s.gaze, gazeAt: 4.4 } }, { cam: 'CLOCK', dur: 2.2, src: 6.0, o: { gaze: s.gaze } }]);
    case 'match': return seqFrom([{ cam: 'CUP', dur: 2.2, src: 2 }, { cam: 'MATCH', spec: matchCam(s.align), dur: 2.2, src: 4.2 }]);
    case 'line': return seqFrom([{ cam: 'CUA', dur: 2.3, src: 0.4 }, { cam: s.cross ? 'CUBX' : 'CUB', dur: 2.6, src: 3.3 }]);
    default: return seqFrom([{ cam: 'WIDE', dur: 1.3, src: 13.3 }, { cam: 'JUMP', spec: camSwing(CAMS.WIDE, s.ang, { name: `Wide, swung ${Math.round(s.ang)}°`, short: `WIDE +${Math.round(s.ang)}°`, col: '#9fb4ff' }), dur: 1.9, src: 15.4 }]);
  }
}
const specOf = (c) => c.spec || CAMS[c.cam];
// Area of overlap of two circles (x, y, r), divided by the area of their union.
function circleIoU(a, b) {
  const d = Math.hypot(a.x - b.x, a.y - b.y), r = a.r, R = b.r;
  let inter;
  if (d >= r + R) inter = 0;
  else if (d <= Math.abs(R - r)) inter = Math.PI * Math.min(r, R) ** 2;
  else inter = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r)) + R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R)) - 0.5 * Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
  return inter / (Math.PI * (r * r + R * R) - inter);
}

export default {
  id: 'continuity',
  short: 'Continuity',
  title: 'Continuity: hiding the cut',
  subtitle: 'Cut on action, match the eyeline, keep to one side of the line. Or break the rules on purpose.',
  view: { pos: [3.0, 3.4, 11.2], target: [3.05, 1.85, 0] },
  learn: `<p>Classic <b>continuity editing</b> is a set of tricks that make a string of separate shots feel like one smooth flow of time and space.</p>
    <p><b>Cut on action.</b> Cut in the middle of a movement, like a door opening, and the eye follows the movement straight across the cut. The action must carry on from exactly where it was, or it jumps or repeats.</p>
    <p><b>Eyeline match.</b> Show someone looking, then cut to what they see. We read the second shot as their view.</p>
    <p><b>Match cut.</b> Join two shots through a shape or movement they share, like a round cup and a round clock. A famous one in <i>2001: A Space Odyssey</i> (1968) jumps from a thrown bone to a spacecraft.</p>
    <p><b>The 180° rule.</b> Keep every camera on one side of the line between two people, so they keep their sides of the screen and seem to face each other. How the shots are planned is in StoryboardClear.</p>
    <p><b>Jump cut.</b> Cut time out of one shot without changing the angle and people seem to leap. Editors usually change the angle by at least about <b>30°</b>. <i>Breathless</i> (1960) used jump cuts on purpose, and so do many vlogs today.</p>
    <p>The editor Walter Murch ranks what matters in a cut with his <b>Rule of Six</b>. Emotion comes first, at 51%. The continuity rules are last, but they still matter.</p>
    <p class="tip"><b>Try it:</b> in <i>Cut on action</i>, drag the mismatch slider and compare the last frame out and the first frame in. Then try each rule, and break it.</p>`,
  terms: [
    { t: 'Continuity editing', d: 'Cutting so that time, space and action seem to flow on without a break.' },
    { t: 'Cut on action', d: 'Cutting in the middle of a movement, so the movement carries the eye across the cut.' },
    { t: 'Eyeline match', d: 'A shot of someone looking, followed by a shot of what they see.' },
    { t: 'Match cut', d: 'A cut between two shots that share a shape, movement or colour.' },
    { t: 'Jump cut', d: 'A cut that removes time from one shot, so things seem to leap.' },
    { t: '30-degree rule', d: 'A guideline: change the camera angle by at least 30° between two shots of the same subject.' },
    { t: 'Rule of Six', d: 'Walter Murch’s ranking of what a cut should serve: emotion, story, rhythm, eye-trace, 2D plane, 3D space.' },
  ],
  defaults: { mode: 'action', mis: 0, gaze: 'clock', align: 0, cross: false, ang: 8, play: true, t: 0 },
  onChange(s, key) {
    if (key === 'mis') s.mode = 'action';
    if (key === 'gaze') s.mode = 'eyeline';
    if (key === 'align') s.mode = 'match';
    if (key === 'cross') s.mode = 'line';
    if (key === 'ang') s.mode = 'jump';
  },
  controls: [
    { key: 'mode', type: 'seg', label: 'Rule', options: Object.entries(MODES).map(([v, label]) => ({ v, label })) },
    { key: 'mis', type: 'range', label: 'Cut on action: mismatch', min: -1, max: 1, step: 1 / 24, ends: ['action repeats', 'action skips'], fmt: (v) => `${v > 0 ? '+' : ''}${Math.round(v * FPS)} frames` },
    { key: 'gaze', type: 'seg', label: 'Eyeline: Asha looks', options: [{ v: 'clock', label: 'Up at the clock' }, { v: 'floor', label: 'At the floor' }] },
    { key: 'align', type: 'range', label: 'Match cut: shape alignment', min: 0, max: 1, step: 0.01, ends: ['lined up', 'off'], fmt: (v) => (v < 0.1 ? 'lined up' : v < 0.5 ? 'a little off' : 'far off') },
    { key: 'cross', type: 'toggle', label: '180°: put Kabir’s camera across the line' },
    { key: 'ang', type: 'range', label: 'Jump cut: change of angle', min: 0, max: 60, step: 1, fmt: (v) => `${Math.round(v)}°` },
    { key: 'play', type: 'toggle', label: 'Play' },
  ],
  quiz: [
    { q: 'Why do editors like to cut in the middle of a movement?', options: ['It saves film', 'The movement carries the eye across the cut, so it feels smooth', 'Cameras can only stop when things move', 'It makes the film longer'], answer: 1, why: 'The viewer is following the action, so a cut during it goes unnoticed, as long as the action continues from exactly the same point.' },
    { q: 'A close-up of Asha looking right, then a close-up of Kabir also looking right. What went wrong?', options: ['Nothing', 'The second camera crossed the 180° line', 'The lens was too long', 'The cut was too fast'], answer: 1, why: 'Crossing the line flips screen direction. Both now look the same way, so they seem to face away from each other.' },
    { q: 'What does Walter Murch rank first in his Rule of Six?', options: ['Keeping the 180° line', 'Emotion', 'Rhythm', 'Eye-trace'], answer: 1, why: 'Emotion gets 51% in his scheme. He would give up perfect continuity for a cut that feels right.' },
  ],
  reel: [
    { ms: 5000, caption: 'Cut in the middle of a movement and the eye follows it straight across the cut.', set: { mode: 'action', mis: 0, play: true, t: 0.4 }, spin: 0 },
    { ms: 4800, caption: 'Cross the 180-degree line and two people who face each other seem to look away.', set: { mode: 'line', cross: true, play: true, t: 0.6 }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const set = makeSet({ rigs: ['WIDE', 'DOOR', 'CUA', 'CUB'] }); root.add(set.group);
    const shooter = new Shooter(stage, set);
    const prog = makeMonitor(root, shooter, 3.4, 1.9125, { label: 'PROGRAM · the cut, looping', col: COL.red });
    const fOut = makeMonitor(root, shooter, 1.55, 0.872, { label: 'LAST FRAME OUT', col: '#9fb4ff', pxW: 320, pxH: 180 });
    const fIn = makeMonitor(root, shooter, 1.55, 0.872, { label: 'FIRST FRAME IN', col: COL.hot, pxW: 320, pxH: 180 });
    const six = board(root, 2.2, 1.45, 520, 342, () => {}, null); shooter.hide.push(six.mesh);
    const tl = board(root, 3.4, 0.95, 820, 230, () => {}, null); shooter.hide.push(tl.mesh);
    const layout = suiteLayout(stage, [
      [prog.group, { pos: [6.95, 3.2, 0.2] }, { pos: [0, 6.3, 0], scale: 1.08 }],
      [fOut.group, { pos: [4.25, 3.72, 0.2] }, { pos: [-0.86, 4.55, 0.1], scale: 1.0 }],
      [fIn.group, { pos: [4.25, 2.55, 0.2] }, { pos: [0.86, 4.55, 0.1], scale: 1.0 }],
      [six.mesh, { pos: [4.25, 1.05, 0.7], rx: -0.3 }, null],
      [tl.mesh, { pos: [6.95, 1.2, 0.7], rx: -0.3 }, null],
    ], this.view, { pos: [0, 4.6, 5.0], target: [0, 3.55, 0] });
    const lSet = stage.label('The set', [0, 2.95, -1.6], set.group);

    const drawSix = (mode) => {
      const g = six.canvas.getContext('2d'), W = 520, H = 342; panelBg(g, W, H);
      text(g, 'MURCH’S RULE OF SIX', 20, 34, { font: `600 20px ${SANS}`, col: '#e8eef8' });
      text(g, 'What a good cut should respect, and how much', 20, 58, { font: `15px ${SANS}`, col: COL.soft });
      const hot = HOT[mode] || [];
      MURCH.forEach((m, i) => {
        const y = 80 + i * 42, on = hot.includes(i);
        text(g, m.k, 20, y + 22, { font: `${on ? 600 : 400} 16px ${SANS}`, col: on ? COL.hot : 'rgba(255,255,255,.8)' });
        g.fillStyle = 'rgba(255,255,255,.08)'; rrect(g, 230, y + 6, 240, 20, 5); g.fill();
        g.fillStyle = on ? COL.hot : i === 0 ? COL.bad : '#7aa2ff'; rrect(g, 230, y + 6, Math.max(6, 240 * m.v / 51), 20, 5); g.fill();
        text(g, `${m.v}%`, 505, y + 22, { font: `600 16px ${SANS}`, col: '#fff', align: 'right' });
      });
      six.tex.needsUpdate = true;
    };

    let frameKey = '', tlKey = '', lastQ = 0, info = {};
    const faceDir = (spec, t, o, who) => { shooter.aim(spec); set.pose(t, o); return screenFacing(shooter, set[who]).dir; };
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt);
        const seq = sequence(s), dur = seq[seq.length - 1].b;
        if (s.play) { s.t = (s.t + dt) % dur; } else s.t = clamp(s.t, 0, dur - 0.01);
        const lay = layout();
        const cut = seq[1].a, out = seq[0], inn = seq[1];
        const outT = out.src + (cut - out.a) - 1 / FPS, inT = inn.src;
        // Still frames either side of the cut (re-rendered only when the edit changes).
        const fk = `${s.mode}|${s.mis}|${s.gaze}|${s.align}|${s.cross}|${s.ang}`;
        if (fk !== frameKey) {
          frameKey = fk;
          shooter.shoot(fOut.rtA, specOf(out), outT, out.o);
          const m = {};
          if (s.mode === 'action') m.out = doorAngle(outT);
          if (s.mode === 'eyeline') { set.pose(outT, out.o); const e = set.asha.eye(), n = set.asha.nose(), d = n.sub(e).normalize(), c = new THREE.Vector3(...set.CLOCK).sub(set.asha.eye()).normalize(); m.miss = Math.acos(clamp(d.dot(c), -1, 1)) / D2R; }
          if (s.mode === 'match') {
            shooter.aim(specOf(out)); const cc = new THREE.Vector3(set.CUP_A[0], set.TABLE_H + 0.08, set.CUP_A[1]);
            const toPx = (v) => { const p = shooter.project(v); return { x: (p.x + 1) * 8, y: (p.y + 1) * 4.5 }; };
            const a0 = toPx(cc), a1 = toPx(cc.clone().add(new THREE.Vector3(0.04, 0, 0)));
            shooter.aim(specOf(inn)); const k0 = new THREE.Vector3(...set.CLOCK), b0 = toPx(k0), b1 = toPx(k0.clone().add(new THREE.Vector3(0.205, 0, 0)));
            m.iou = circleIoU({ x: a0.x, y: a0.y, r: Math.hypot(a1.x - a0.x, a1.y - a0.y) }, { x: b0.x, y: b0.y, r: Math.hypot(b1.x - b0.x, b1.y - b0.y) });
            m.sizeA = Math.hypot(a1.x - a0.x, a1.y - a0.y) * 2 / 9; m.sizeB = Math.hypot(b1.x - b0.x, b1.y - b0.y) * 2 / 9;
          }
          if (s.mode === 'line') { m.a = faceDir(specOf(out), 1.5, {}, 'asha'); m.b = faceDir(specOf(inn), 4.0, {}, 'kabir'); }
          shooter.shoot(fIn.rtA, specOf(inn), inT, inn.o);
          if (s.mode === 'action') m.in = doorAngle(inT);
          info.m = m;
          fOut.overlay(fk, (x, W, H) => drawBurnIn(x, W, H, { tag: specOf(out).short, tagCol: specOf(out).col, tcode: tc(outT, 14) }));
          fIn.overlay(fk, (x, W, H) => drawBurnIn(x, W, H, { tag: specOf(inn).short, tagCol: specOf(inn).col, tcode: tc(inT, 14) }));
          drawSix(s.mode);
        }
        const i = clipIndex(seq, s.t), c = seq[i], srcT = c.src + (s.t - c.a);
        shooter.shoot(prog.rtA, specOf(c), srcT, c.o || {});
        Object.entries(set.rigs).forEach(([k, r]) => r.tally(k === c.cam ? 'live' : ''));
        const l = lineAt(srcT), f = Math.round(s.t * 24);
        const near = Math.abs(s.t - cut) < 0.25;
        prog.overlay(`${s.mode}|${c.cam}|${f}|${l?.text}|${near}`, (x, W, H) => drawBurnIn(x, W, H, { tag: `${i + 1}  ${specOf(c).short}`, tagCol: specOf(c).col, tcode: tc(s.t), sub: l && s.mode !== 'match' ? { name: NAMES[l.who], text: l.text, col: l.who === 'A' ? '#ffc2b8' : '#b9f5dc' } : null, note: near ? 'CUT' : '' }));
        const k = `${Math.round(s.t * 30)}|${fk}`;
        if (k !== tlKey) { tlKey = k; drawTimeline(tl.canvas.getContext('2d'), 820, 230, seq.map((q) => ({ ...q, cam: q.spec ? '_' : q.cam, col: specOf(q).col, label: specOf(q).short })), { dur, t: s.t, title: MODES[s.mode].toUpperCase(), audio: [] }); tl.tex.needsUpdate = true; }
        if (s.play && time - lastQ > 0.3) lastQ = time;
        info.s = s; info.seq = seq;
        fitNarrow(stage, [lSet], -0.05);
      },
      readout(s) {
        const m = info.m || {};
        const row = (a, b, cls = '') => `<div class="row"><span>${a}</span><b class="${cls}">${b}</b></div>`;
        let big = MODES[s.mode], rows = '';
        if (s.mode === 'action') {
          const j = (m.in ?? 0) - (m.out ?? 0), fr = Math.round(s.mis * FPS);
          big = Math.abs(fr) <= 1 ? 'Seamless: the door keeps moving' : fr > 0 ? 'The action skips ahead' : 'The action repeats';
          rows = row('Door, last frame out', `${(m.out ?? 0).toFixed(0)}°`) + row('Door, first frame in', `${(m.in ?? 0).toFixed(0)}°`) + row('Jump at the cut', `${j >= 0 ? '+' : ''}${j.toFixed(0)}°`, Math.abs(j) < 6 ? 'ok' : 'no') + row('Mismatch', `${fr > 0 ? '+' : ''}${fr} frames (${(s.mis).toFixed(2)} s)`);
        } else if (s.mode === 'eyeline') {
          const ok = (m.miss ?? 90) < 12;
          big = ok ? 'We see what she sees' : 'The look and the clock don’t connect';
          rows = row('Her gaze misses the clock by', `${(m.miss ?? 0).toFixed(0)}°`, ok ? 'ok' : 'no') + row('Next shot', 'the clock, from her side');
        } else if (s.mode === 'match') {
          const ok = (m.iou ?? 0) > 0.7;
          big = ok ? 'The shapes line up: a match cut' : 'The shapes don’t line up';
          rows = row('Circle overlap across the cut', `${Math.round((m.iou ?? 0) * 100)}%`, ok ? 'ok' : 'no') + row('Cup rim, share of frame height', `${Math.round((m.sizeA ?? 0) * 100)}%`) + row('Clock, share of frame height', `${Math.round((m.sizeB ?? 0) * 100)}%`);
        } else if (s.mode === 'line') {
          const ok = m.a !== m.b;
          big = ok ? 'They face each other' : 'Crossed the line: both look the same way';
          rows = row('Asha looks towards', m.a > 0 ? 'screen right' : 'screen left') + row('Kabir looks towards', m.b > 0 ? 'screen right' : 'screen left', ok ? 'ok' : 'no') + row('Kabir’s camera', s.cross ? 'across the line' : 'safe side');
        } else {
          const ok = s.ang >= 30;
          big = ok ? 'A new angle: the cut reads as a cut' : 'A jump cut';
          rows = row('Change of angle', `${Math.round(s.ang)}°`, ok ? 'ok' : 'no') + row('Time removed', '0.8 s') + row('30-degree rule', ok ? 'kept' : 'broken');
        }
        return `<div class="big">${big}</div>${rows}`;
      },
      dispose() { shooter.dispose(); stage.setShift(0, 0); },
    };
  },
};
