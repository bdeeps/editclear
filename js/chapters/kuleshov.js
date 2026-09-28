// Chapter 3: the Kuleshov effect and Soviet montage. One neutral close-up of Kabir (the very same frames
// each time), cut with an insert: a bowl of soup, a child playing, or a coffin. In Vsevolod Pudovkin's
// 1929 account of Lev Kuleshov's experiment (1910s–1920s, actor Ivan Mosjoukine), the inserts were a bowl
// of soup, a girl in a coffin and a woman on a divan, and viewers read hunger, grief and desire into the
// same face. No footage is known to survive. Modern tests: Prince & Hensley (1992, 137 viewers) did not find
// the effect; Mobbs et al. (2006, fMRI) and Barratt et al. (2016, 36 viewers, 24 sequences) found that the
// context does shift how a neutral face is read. Sources: Wikipedia "Kuleshov effect"; Barratt et al.,
// Perception 45(8), 2016; Mobbs et al., Social Cognitive and Affective Neuroscience 1(2), 2006.
// The readings on the meaning board are the ones reported for each kind of context, not new data.
import { THREE } from '../kit.js';
import {
  makeSet, Shooter, makeMonitor, board, drawTimeline, drawBurnIn, suiteLayout, fitNarrow, panelBg, text, wrap, rrect,
  CAMS, COL, SANS, seqFrom, clipIndex, tc, clamp,
} from '../edit.js';

export const INSERTS = {
  soup: { cam: 'SOUP', name: 'A bowl of soup', read: 'hunger', col: COL.warm, line: 'He looks hungry, or thoughtful.' },
  child: { cam: 'CHILD', name: 'A child playing', read: 'tenderness', col: '#ff8fc8', line: 'He looks fond, gentle, a little happy.' },
  coffin: { cam: 'COFFIN', name: 'A coffin', read: 'grief', col: '#b0b8c8', line: 'He looks full of sorrow.' },
};
const FACE = { cam: 'KFACE', src: 1.0, o: { kule: true } };
function sequence(s) {
  const ins = { cam: INSERTS[s.insert].cam, src: 1.0, o: { kule: true } };
  return s.order === 'fif'
    ? seqFrom([{ ...FACE, dur: 2.4 }, { ...ins, dur: 2.4 }, { ...FACE, dur: 2.4 }])
    : seqFrom([{ ...ins, dur: 2.4 }, { ...FACE, dur: 2.4 }]);
}

export default {
  id: 'kuleshov',
  short: 'Kuleshov',
  title: 'The Kuleshov effect: meaning from the cut',
  subtitle: 'The same blank face, next to soup, a child or a coffin, seems to feel different things.',
  view: { pos: [0.1, 3.9, 12.2], target: [0.1, 2.6, 0] },
  learn: `<p>In Moscow in the late 1910s or early 1920s, the young film-maker <b>Lev Kuleshov</b> is said to have cut one expressionless close-up of the actor Ivan Mosjoukine next to different shots. According to his student Vsevolod Pudovkin, viewers praised the actor’s subtle acting: hungry next to the soup, grieving next to a coffin. <b>The face was exactly the same</b> each time.</p>
    <p>This is the <b>Kuleshov effect</b>: the meaning of a shot depends on the shots around it. Our mannequin does not even have a face, yet your mind still fills one in. Kuleshov’s film is lost, and scientists have argued about it. One careful re-run in 1992 found little effect, but later studies, including brain scans in 2006, found that the context really does change how people read a neutral face.</p>
    <p>Soviet film-makers built a whole theory of <b>montage</b> on this idea. <b>Sergei Eisenstein</b> believed a cut should make two shots collide and spark a new idea. In the “Odessa Steps” sequence of <i>Battleship Potemkin</i> (1925), soldiers march down a long flight of steps while the crowd flees. Eisenstein cuts between boots, faces, a mother and a runaway pram, stretching a few moments of panic into minutes. Editors still study it.</p>
    <p class="tip"><b>Try it:</b> pick an insert and watch the program monitor. Then swap the insert and watch the face again. It is the same picture, frame for frame.</p>`,
  terms: [
    { t: 'Kuleshov effect', d: 'Viewers read a different feeling into the same face depending on the shot next to it.' },
    { t: 'Insert', d: 'A shot of an object or detail cut into a scene.' },
    { t: 'Montage', d: 'Building meaning by joining shots. In Soviet theory, by making them collide.' },
    { t: 'Soviet montage', d: 'A 1920s school of film-making (Kuleshov, Eisenstein, Pudovkin, Vertov) that put editing at the heart of cinema.' },
  ],
  defaults: { insert: 'soup', order: 'fif', play: true, t: 0 },
  controls: [
    { key: 'insert', type: 'seg', label: 'Insert shot', options: Object.entries(INSERTS).map(([v, o]) => ({ v, label: o.name.replace(/^A /, '') })) },
    { key: 'order', type: 'seg', label: 'Order', options: [{ v: 'fif', label: 'Face → insert → face' }, { v: 'if', label: 'Insert → face' }] },
    { key: 'play', type: 'toggle', label: 'Play' },
  ],
  quiz: [
    { q: 'In the Kuleshov experiment, what changed between versions?', options: ['The actor’s expression', 'Only the shot cut next to the face', 'The lighting', 'The music'], answer: 1, why: 'The close-up was identical every time. Only the neighbouring shot changed, and with it what viewers thought the actor felt.' },
    { q: 'What did Eisenstein believe a cut should do?', options: ['Be invisible', 'Make two shots collide to spark a new idea', 'Always follow the dialogue', 'Last at least ten seconds'], answer: 1, why: 'Soviet montage treated the cut as a collision that creates meaning, not just a way to join shots smoothly.' },
    { q: 'Do modern studies support the Kuleshov effect?', options: ['No, never tested', 'Mostly yes: context shifts how a neutral face is read, though one 1992 test found little effect', 'It only works on children', 'It only works with music'], answer: 1, why: 'Prince and Hensley (1992) did not find it, but studies such as Mobbs et al. (2006) and Barratt et al. (2016) found a real, modest effect.' },
  ],
  reel: [
    { ms: 5200, caption: 'The same blank face, cut next to a bowl of soup: viewers say he looks hungry.', set: { insert: 'soup', order: 'fif', play: true, t: 0.4 }, spin: 0 },
    { ms: 5200, caption: 'Swap the soup for a coffin and the same face now seems full of grief.', set: { insert: 'coffin', order: 'fif', play: true, t: 0.4 }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const set = makeSet({ inserts: true, rigs: ['KFACE', 'SOUP', 'CHILD', 'COFFIN'] }); root.add(set.group);
    const shooter = new Shooter(stage, set);
    const prog = makeMonitor(root, shooter, 3.0, 1.6875, { label: 'PROGRAM', col: COL.red });
    const mean = board(root, 3.0, 1.9, 600, 380, () => {}, null); shooter.hide.push(mean.mesh);
    const tl = board(root, 3.0, 0.8, 760, 200, () => {}, null); shooter.hide.push(tl.mesh);
    const layout = suiteLayout(stage, [
      [prog.group, { pos: [0.9, 4.0, -1.5], scale: 1.05 }, { pos: [-2.0, 6.15, 0], scale: 1.12 }],
      [mean.mesh, { pos: [4.15, 1.75, 0.3], rx: -0.12 }, { pos: [-2.0, 4.2, 0.2], scale: 1.0, rx: -0.1 }],
      [tl.mesh, { pos: [4.15, 3.55, 0.0] }, null],
    ], this.view, { pos: [-2.0, 4.4, 5.2], target: [-2.0, 3.4, 0] });
    const labels = [stage.label('Soup', [-4.3, 0.95, 1.7], set.group), stage.label('Child', [-4.3, 1.45, 0], set.group), stage.label('Coffin', [-4.3, 1.95, -1.7], set.group), stage.label('Kabir: one neutral close-up', [0.8, 1.7, 0], set.group, 'hot')];

    const drawMeaning = (s) => {
      const g = mean.canvas.getContext('2d'), W = 600, H = 380; panelBg(g, W, H);
      text(g, 'WHAT VIEWERS READ INTO THE SAME FACE', 20, 34, { font: `600 19px ${SANS}`, col: '#e8eef8' });
      Object.entries(INSERTS).forEach(([k, o], i) => {
        const x = 20 + i * 190, on = k === s.insert;
        g.fillStyle = on ? o.col : 'rgba(255,255,255,.07)'; rrect(g, x, 52, 176, 118, 10); g.fill();
        text(g, o.name.replace(/^A /, '').toUpperCase(), x + 12, 80, { font: `600 15px ${SANS}`, col: on ? '#0b0d12' : COL.soft });
        text(g, o.read, x + 12, 124, { font: `600 30px ${SANS}`, col: on ? '#0b0d12' : '#fff' });
        text(g, on ? '◀ now' : '', x + 12, 156, { font: `600 15px ${SANS}`, col: '#0b0d12' });
      });
      let y = 204;
      text(g, 'THE EVIDENCE', 20, y, { font: `600 15px ${SANS}`, col: COL.hot }); y += 26;
      y = wrap(g, 'c. 1918–21 · Kuleshov (as told by Pudovkin): audiences praise the "acting". The footage is lost.', 20, y, 560, 22, { font: `15px ${SANS}`, col: 'rgba(255,255,255,.82)' });
      y = wrap(g, '1992 · Prince & Hensley, 137 viewers: no clear effect.', 20, y + 4, 560, 22, { font: `15px ${SANS}`, col: 'rgba(255,255,255,.82)' });
      wrap(g, '2006 · Mobbs et al. (brain scans) and 2016 · Barratt et al.: the context does change how a neutral face is read.', 20, y + 4, 560, 22, { font: `15px ${SANS}`, col: 'rgba(255,255,255,.82)' });
      mean.tex.needsUpdate = true;
    };

    let key = '', tlKey = '', info = {};
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const seq = sequence(s), dur = seq[seq.length - 1].b;
        if (s.play) s.t = (s.t + dt) % dur; else s.t = clamp(s.t, 0, dur - 0.01);
        const lay = layout();
        if (key !== s.insert + s.order) { key = s.insert + s.order; drawMeaning(s); }
        const i = clipIndex(seq, s.t), c = seq[i], srcT = c.src + (s.t - c.a);
        shooter.shoot(prog.rtA, CAMS[c.cam], srcT, c.o);
        Object.entries(set.rigs).forEach(([k, r]) => r.tally(k === c.cam ? 'live' : ''));
        const f = Math.round(srcT * 24);
        prog.overlay(`${c.cam}|${f}|${i}`, (x, W, H) => drawBurnIn(x, W, H, { tag: `${i + 1}  ${CAMS[c.cam].short}`, tagCol: CAMS[c.cam].col, tcode: `${CAMS[c.cam].roll}  ${tc(srcT, 14)}` }));
        const k = `${Math.round(s.t * 30)}|${key}`;
        if (k !== tlKey && lay === 'wide') { tlKey = k; drawTimeline(tl.canvas.getContext('2d'), 760, 200, seq.map((q) => ({ ...q, label: q.cam === 'KFACE' ? 'FACE' : CAMS[q.cam].short })), { dur, t: s.t, title: 'SEQUENCE', audio: [] }); tl.tex.needsUpdate = true; }
        info = { seq, i, c };
        fitNarrow(stage, labels.slice(0, 3), -0.05);
      },
      readout(s) {
        if (!info.seq) return '';
        const o = INSERTS[s.insert];
        const order = info.seq.map((q) => (q.cam === 'KFACE' ? 'Face' : o.name.split(' ').pop())).join(' → ');
        return `<div class="big">${o.line}</div>
          <div class="row"><span>Sequence</span><b>${order}</b></div>
          <div class="row"><span>The face shots</span><b>identical: the same 58 frames</b></div>
          <div class="row"><span>Viewers tend to read</span><b>${o.read}</b></div>`;
      },
      dispose() { shooter.dispose(); stage.setShift(0, 0); },
    };
  },
};
