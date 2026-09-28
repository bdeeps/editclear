// Chapter 1: the cut. A small editing suite: a source monitor (raw footage from one set-up), a program
// monitor (the edit) and a timeline. The café scene was covered by three set-ups at once: a wide master and
// two close-ups, all on one side of the 180-degree line. Choosing an edit, or dragging a cut point on the
// timeline, changes which camera the program monitor plays from moment to moment.
// "Motivated" cuts are counted as cuts that fall in a pause between lines (a change of speaker) or on a
// movement (Asha getting up, 12.9 to 13.8 s): the usual guidance in editing texts such as Walter Murch,
// In the Blink of an Eye (1995/2001) and Ken Dancyger, The Technique of Film and Video Editing.
import { THREE } from '../kit.js';
import {
  makeSet, Shooter, makeMonitor, board, drawTimeline, drawBurnIn, boardPointer, suiteLayout, fitNarrow, quietSlider, setControl,
  CAMS, LINES, NAMES, DUR, COL, realTime, clipIndex, asl, lineAt, tc, clamp,
} from '../edit.js';

export const PRESETS = {
  wide: { name: 'One wide take', seq: realTime([], ['WIDE']) },
  speaker: { name: 'Follow the talker', seq: realTime([1.2, 3.05, 6.45, 9.3, 12.3, 13.4], ['WIDE', 'CUA', 'CUB', 'CUA', 'CUB', 'CUA', 'WIDE']) },
  react: { name: 'With reactions', seq: realTime([1.2, 3.05, 5.1, 9.1, 12.9], ['WIDE', 'CUA', 'CUB', 'CUA', 'CUB', 'WIDE']) },
  random: { name: 'Random cuts', seq: realTime([1.7, 4.4, 5.3, 8.1, 10.9, 14.9], ['WIDE', 'CUB', 'CUA', 'WIDE', 'CUA', 'CUB', 'WIDE']) },
};
const clone = (q) => q.map((c) => ({ ...c }));
// A cut is motivated if it lands in a pause between two speakers, within 0.35 s of a line's edge, or on Asha standing up.
export function motivated(t) {
  if (t > 12.8 && t < 13.9) return true;
  for (let i = 0; i < LINES.length; i++) {
    const l = LINES[i], n = LINES[i + 1];
    if (Math.abs(t - l.t1) < 0.35 || Math.abs(t - l.t0) < 0.35) return true;
    if (n && t > l.t1 && t < n.t0) return true;
  }
  return false;
}
export function editStats(seq) {
  const cuts = seq.slice(1).map((c) => c.a);
  const good = cuts.filter(motivated).length;
  // Talker visible: while someone speaks, is the program on their close-up or the wide (where both are seen)?
  let spoken = 0, seen = 0;
  for (let t = 0; t < DUR; t += 0.05) {
    const l = lineAt(t); if (!l) continue; spoken++;
    const c = seq[clipIndex(seq, t)].cam;
    if (c === 'WIDE' || (l.who === 'A' && c === 'CUA') || (l.who === 'B' && c === 'CUB')) seen++;
  }
  return { cuts: cuts.length, good, seen: spoken ? seen / spoken : 0, asl: asl(seq) };
}

export default {
  id: 'cut',
  short: 'The cut',
  title: 'The cut: choosing what we see',
  subtitle: 'Three cameras filmed the same moment. The editor decides which one you watch, and when.',
  view: { pos: [3.0, 3.4, 11.2], target: [3.05, 1.85, 0] },
  learn: `<p>A scene is rarely filmed in one go. Here two friends talk in a café, and the crew covered it from three <b>set-ups</b>: a <b>wide master</b> and a <b>close-up</b> of each face. The editor now has three versions of every moment.</p>
    <p>Editing means choosing, moment by moment, which one you see. The switch from one shot to the next is a <b>cut</b>. It takes no time at all: one frame is the wide, the next is Asha's face. On the <b>timeline</b>, the picture track <b>V1</b> holds the shots and <b>A1</b> holds the dialogue.</p>
    <p>A good cut is almost <b>invisible</b>. It feels natural when something <b>motivates</b> it: a new person starts to talk, someone looks up, someone stands. Cut for no reason, halfway through a word, and the audience feels a bump.</p>
    <p>Editors do this on software such as <b>Avid Media Composer</b>, <b>Adobe Premiere Pro</b>, <b>DaVinci Resolve</b> or <b>Final Cut Pro</b>. The ideas are the same in all of them. How the shots were planned is in StoryboardClear.</p>
    <p class="tip"><b>Try it:</b> play each edit and watch the program monitor. Then drag a white cut line on the timeline (or tap a clip to see its camera in the source monitor) and see if you can make the cuts feel smooth.</p>`,
  terms: [
    { t: 'Cut', d: 'An instant change from one shot to the next.' },
    { t: 'Set-up', d: 'One position of the camera. A scene is usually covered from several.' },
    { t: 'Master shot', d: 'A wide shot that records the whole scene, used to show where everyone is.' },
    { t: 'Timeline', d: 'The editor’s workspace: shots laid end to end on picture and sound tracks.' },
    { t: 'Source and program', d: 'The source monitor shows raw footage to choose from. The program monitor plays the edit.' },
    { t: 'Motivated cut', d: 'A cut that happens for a reason the viewer feels: a new speaker, a look or a movement.' },
  ],
  defaults: { edit: 'speaker', src: 'CUA', play: true, t: 0 },
  controls: [
    { key: 'edit', type: 'seg', label: 'Edit', options: Object.entries(PRESETS).map(([v, p]) => ({ v, label: p.name })), fmt: (v) => PRESETS[v] ? '' : 'your own cuts' },
    { key: 'src', type: 'seg', label: 'Source monitor', options: [{ v: 'WIDE', label: 'Wide' }, { v: 'CUA', label: 'CU Asha' }, { v: 'CUB', label: 'CU Kabir' }] },
    { key: 'play', type: 'toggle', label: 'Play' },
    { key: 't', type: 'range', label: 'Playhead', min: 0, max: DUR, step: 0.05, fmt: (v) => `${v.toFixed(1)} s` },
  ],
  quiz: [
    { q: 'How long does a cut take on screen?', options: ['About half a second', 'No time: one frame is the old shot, the next is the new one', 'One second', 'It depends on the camera'], answer: 1, why: 'A cut is instant. The last frame of one shot is followed straight away by the first frame of the next.' },
    { q: 'Which cut is most likely to feel invisible?', options: ['One in the middle of a word', 'One just as a new person starts to speak', 'One every half second', 'One that jumps to the same camera'], answer: 1, why: 'A change of speaker motivates the cut. The viewer wants to see who is talking, so they hardly notice the switch.' },
    { q: 'What is on the V1 track of a timeline?', options: ['The music', 'The picture: the shots in order', 'The credits', 'The script'], answer: 1, why: 'V1 is the first video (picture) track. Sound lives on A1, A2 and so on.' },
  ],
  reel: [
    { ms: 5200, caption: 'Three cameras filmed the same moment. The editor picks which one you see.', set: { edit: 'speaker', src: 'CUB', play: true, t: 0.2 }, spin: 0 },
    { ms: 5200, caption: 'A cut takes no time at all, and it hides best when a new person starts to speak.', set: { edit: 'speaker', src: 'CUA', play: true, t: 5.2 }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const set = makeSet({ rigs: ['WIDE', 'CUA', 'CUB'] }); root.add(set.group);
    const shooter = new Shooter(stage, set);
    const src = makeMonitor(root, shooter, 2.2, 1.2375, { label: 'SOURCE · raw footage', col: '#38bdf8', pxW: 480, pxH: 270 });
    const prog = makeMonitor(root, shooter, 3.4, 1.9125, { label: 'PROGRAM · the edit', col: COL.red });
    const tl = board(root, 5.6, 1.6, 1024, 292, () => {}, null); shooter.hide.push(tl.mesh);
    const layout = suiteLayout(stage, [
      [src.group, { pos: [3.95, 3.35, 0.2] }, null],
      [prog.group, { pos: [6.95, 3.2, 0.2] }, { pos: [0, 6.25, 0], scale: 1.08 }],
      [tl.mesh, { pos: [5.45, 1.25, 0.7], rx: -0.3 }, { pos: [0, 4.25, 0.25], scale: 0.66, rx: -0.15 }],
    ], this.view, { pos: [0, 4.6, 5.0], target: [0, 3.55, 0] });
    const lSrc = stage.label('Source monitor', [0, -0.75, 0.05], src.group);
    const lProg = stage.label('Program monitor: your edit', [0, -1.08, 0.05], prog.group);
    const lTl = stage.label('Timeline · drag a white cut', [0, -0.95, 0.05], tl.mesh, 'hot');
    const lSet = stage.label('The set: 3 cameras, 1 scene', [0, 2.95, -1.6], set.group);

    let seq = clone(PRESETS.speaker.seq), lastEdit = 'speaker', cur = null, dragI = -1, tlKey = '', lastQ = 0;
    const sync = () => { document.querySelectorAll('#panel .seg[aria-label="Edit"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === cur?.edit)); };
    const tAt = (uv) => (uv.x * 1024 - 118) / (1024 - 18 - 118) * DUR;
    const off = boardPointer(stage, tl.mesh, {
      onDown(uv) {
        if (!cur) return false;
        const T = tAt(uv), y = (1 - uv.y) * 292;
        if (y < 40) return false;
        let best = -1, bd = 0.4;
        seq.forEach((c, i) => { if (i && Math.abs(c.a - T) < bd && y < 190) { bd = Math.abs(c.a - T); best = i; } });
        if (best > 0) { dragI = best; return true; }
        const i = clipIndex(seq, clamp(T, 0, DUR - 0.01));
        if (y < 175 && T >= 0 && T <= DUR) setControl('Source monitor', seq[i].cam);
        dragI = 0; setControl('Playhead', clamp(T, 0, DUR - 0.05).toFixed(2));
        return true;
      },
      onMove(uv) {
        const T = tAt(uv);
        if (dragI > 0) {
          const i = dragI, lo = seq[i - 1].a + 0.25, hi = seq[i].b - 0.25, a = clamp(T, lo, hi);
          seq[i - 1].b = a; seq[i].a = a; seq[i].src = a;
          if (cur.edit !== 'custom') { cur.edit = 'custom'; lastEdit = 'custom'; sync(); }
        } else if (dragI === 0) setControl('Playhead', clamp(T, 0, DUR - 0.05).toFixed(2));
      },
      onUp() { dragI = -1; },
    });

    let info = {};
    return {
      update(dt, s, time) {
        dt = Math.max(0, dt); cur = s;
        if (s.edit !== lastEdit) { if (PRESETS[s.edit]) seq = clone(PRESETS[s.edit].seq); lastEdit = s.edit; }
        if (s.play && dragI < 0) {
          s.t = (s.t + dt) % DUR;
          if (time - lastQ > 0.12) { lastQ = time; quietSlider('Playhead', s.t); }
        }
        const lay = layout();
        const i = clipIndex(seq, s.t), c = seq[i], srcT = c.src + (s.t - c.a);
        shooter.shoot(src.rtA, CAMS[s.src], s.t);
        shooter.shoot(prog.rtA, CAMS[c.cam], srcT);
        Object.entries(set.rigs).forEach(([k, r]) => r.tally(k === c.cam ? 'live' : k === s.src ? 'src' : ''));
        const l = lineAt(srcT);
        const sub = l ? { name: NAMES[l.who], text: l.text, col: l.who === 'A' ? '#ffc2b8' : '#b9f5dc' } : null;
        const f = Math.round(s.t * 24);
        prog.overlay(`${c.cam}|${f}|${l?.text}`, (x, W, H) => drawBurnIn(x, W, H, { tag: `${i + 1}  ${CAMS[c.cam].short}`, tagCol: CAMS[c.cam].col, tcode: tc(s.t), sub }));
        src.overlay(`${s.src}|${f}`, (x, W, H) => drawBurnIn(x, W, H, { tag: CAMS[s.src].short, tagCol: CAMS[s.src].col, tcode: tc(14 * 3600 + s.t, 0) }));
        const k = `${Math.round(s.t * 40)}|${seq.map((q) => q.a.toFixed(2) + q.cam).join()}|${s.src}|${dragI}`;
        if (k !== tlKey) {
          tlKey = k;
          const selI = seq.findIndex((q) => q.cam === s.src && s.t >= q.a && s.t < q.b);
          tl.redraw(); drawTimeline(tl.canvas.getContext('2d'), 1024, 292, seq, { dur: DUR, t: s.t, audio: LINES.map((q) => ({ who: q.who, a: q.t0, b: q.t1 })), sel: selI, hot: dragI > 0 ? dragI : -1, title: 'TIMELINE · SC 12 · CAFÉ' });
          tl.tex.needsUpdate = true;
        }
        info = { i, c, st: editStats(seq), l };
        fitNarrow(stage, [lSet, lSrc], -0.05);
        [lTl, lProg].forEach((q) => { q.visible = lay === 'wide'; });
      },
      readout(s) {
        if (!info.st) return '';
        const { st, c, i, l } = info;
        return `<div class="big">${CAMS[c.cam].name}</div>
          <div class="row"><span>Shot</span><b>${i + 1} of ${seq.length}</b></div>
          <div class="row"><span>Talking now</span><b>${l ? NAMES[l.who] : 'nobody'}</b></div>
          <div class="row"><span>Cuts</span><b>${st.cuts} · ${st.good} motivated</b></div>
          <div class="row"><span>Average shot</span><b>${st.asl.toFixed(1)} s</b></div>
          <div class="row"><span>Talker on screen</span><b class="${st.seen > 0.85 ? 'ok' : st.seen < 0.6 ? 'no' : ''}">${Math.round(st.seen * 100)}% of the lines</b></div>`;
      },
      dispose() { off(); shooter.dispose(); stage.setShift(0, 0); },
    };
  },
};
