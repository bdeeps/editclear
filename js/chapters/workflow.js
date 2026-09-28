// Chapter 6: the post-production workflow, from dailies to the online conform.
//  - Shooting ratio (footage shot ÷ running time): roughly 5:1 to 20:1 on small film shoots, often 50:1 or
//    far more on digital features and documentaries (Wikipedia "Shooting ratio"). See FilmClear.
//  - Offline/online: editors cut with light proxy copies, then "conform" the camera originals to the locked
//    edit using the edit decision list (EDL). Data rates from Apple's ProRes figures at 25 fps (Wikipedia
//    "Apple ProRes"): ProRes 422 Proxy at 1920 × 1080 is 38 Mbit/s = 17.1 GB an hour; ProRes 4444 XQ at
//    3840 × 2160 is 1,659 Mbit/s = 746.6 GB an hour. (GB/h = Mbit/s × 3600 / 8 / 1000.)
//  - The EDL is written in the CMX 3600 style: event, reel, track, transition, source in/out, record in/out.
//  - Cut lengths for the assembly, rough and fine cut are illustrative: an assembly often runs far longer
//    than the finished film, and each pass tightens it.
//  - Indian features are commonly built around an interval (intermission) and several song sequences.
import { THREE } from '../kit.js';
import {
  makeSet, Shooter, makeMonitor, board, drawBurnIn, suiteLayout, fitNarrow, quietSlider, panelBg, text, wrap, rrect,
  CAMS, DUR, COL, SANS, MONO, clipIndex, tc, edl, clamp, lineAt, NAMES,
} from '../edit.js';
import { PRESETS } from './cut.js';

export const STAGES = [
  { id: 'dailies', name: 'Dailies', len: null, look: { uFlat: 1, uPix: 0, uWarm: 0 }, what: 'Every take from the day, synced with sound, watched by the director.' },
  { id: 'assembly', name: 'Assembly', len: 3.2, look: { uFlat: 1, uPix: 0, uWarm: 0 }, what: 'Every scene in script order, using the best takes. Long and loose.' },
  { id: 'rough', name: 'Rough cut', len: 2.6, look: { uFlat: 1, uPix: 0, uWarm: 0 }, what: 'Scenes trimmed, reordered and cut out. The story takes shape.' },
  { id: 'fine', name: 'Fine cut', len: 2.15, look: { uFlat: 1, uPix: 0, uWarm: 0 }, what: 'Every cut tuned frame by frame. Temp music and sound effects go in.' },
  { id: 'lock', name: 'Picture lock', len: 2.0, look: { uFlat: 1, uPix: 0, uWarm: 0 }, what: 'No more picture changes. The EDL goes to VFX, colour and sound.' },
  { id: 'online', name: 'Online', len: 2.0, look: { uFlat: 0, uPix: 0, uWarm: 1 }, what: 'Camera originals conformed, VFX dropped in, graded and mixed.' },
];
const PROXY_GBH = 38 * 3600 / 8 / 1000;      // 17.1 GB an hour
const RAW_GBH = 1659 * 3600 / 8 / 1000;      // 746.6 GB an hour
const RUN_H = 2;
const gb = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} TB` : `${Math.round(v)} GB`);

export default {
  id: 'workflow',
  short: 'The workflow',
  title: 'From dailies to picture lock',
  subtitle: 'Watch everything, assemble, cut it down, lock it, then rebuild it in full quality.',
  view: { pos: [3.4, 3.5, 12.0], target: [3.4, 2.0, 0] },
  learn: `<p>Editing starts during the shoot. Each day’s footage, the <b>dailies</b> (or rushes), is synced with the sound and watched. A feature may shoot 50 or 100 times more footage than ends up on screen: its <b>shooting ratio</b>. FilmClear shows the whole film-making pipeline.</p>
    <p>The editor first builds an <b>assembly</b>: every scene in script order. Then comes the <b>rough cut</b>, where scenes are trimmed, moved or dropped, then the <b>fine cut</b>, tuned frame by frame. When the director and producers sign off, the film reaches <b>picture lock</b>: no more changes to the picture.</p>
    <p>Camera files are huge, so editors usually cut <b>offline</b> with small <b>proxy</b> copies. At lock, the <b>edit decision list</b> (EDL) records every clip’s name and timecode, and the <b>online</b> stage rebuilds the film from the full-quality originals. This is called the <b>conform</b>. Then the VFX shots drop in (VFXClear), the colourist grades (GradeClear, coming soon) and the sound team mixes (FilmSoundClear).</p>
    <p>Indian films are often cut around an <b>interval</b>: the first half builds to a big “interval block” cliffhanger, and the editor also shapes where the <b>songs</b> fall. Great Indian editors include <b>Renu Saluja</b>, who won four National Awards, and <b>A. Sreekar Prasad</b>, who has cut films in 17 languages.</p>
    <p class="tip"><b>Try it:</b> step through the stages and watch the picture change from flat, ungraded dailies to the finished online. Drag the shooting ratio and see how much footage, and storage, that means.</p>`,
  terms: [
    { t: 'Dailies (rushes)', d: 'The raw footage from each day of shooting, synced and watched.' },
    { t: 'Assembly', d: 'The first, long version of the film: every scene in order.' },
    { t: 'Rough cut / fine cut', d: 'Later versions as the edit is shaped, then polished frame by frame.' },
    { t: 'Picture lock', d: 'The point where the edit is final and no more picture changes are allowed.' },
    { t: 'Proxy', d: 'A small, light copy of a camera file used for editing.' },
    { t: 'EDL', d: 'Edit decision list: a text list of every clip in the edit, with its source and timecodes.' },
    { t: 'Conform', d: 'Rebuilding the locked edit from the full-quality camera originals.' },
    { t: 'Interval', d: 'The break halfway through many Indian films, which editors build towards.' },
  ],
  defaults: { stage: 'dailies', ratio: 50, proxy: true, indian: false, play: true, t: 0 },
  controls: [
    { key: 'stage', type: 'seg', label: 'Stage', options: STAGES.map((x) => ({ v: x.id, label: x.name })) },
    { key: 'ratio', type: 'log', label: 'Shooting ratio', min: 5, max: 200, ends: ['5 : 1', '200 : 1'], fmt: (v) => `${Math.round(v)} : 1 = ${Math.round(v * RUN_H)} hours shot` },
    { key: 'proxy', type: 'toggle', label: 'Edit with proxies (offline)' },
    { key: 'indian', type: 'toggle', label: 'Show an Indian feature with an interval' },
    { key: 'play', type: 'toggle', label: 'Play' },
  ],
  quiz: [
    { q: 'What does “picture lock” mean?', options: ['The camera is switched off', 'The edit is final: no more picture changes', 'The film is copy-protected', 'The first day of shooting'], answer: 1, why: 'After picture lock the VFX, grade and sound teams can work knowing every shot and its length is fixed.' },
    { q: 'Why do editors cut with proxies?', options: ['They look better', 'Camera originals are huge; small copies are fast to edit, then the originals are conformed', 'Proxies have better sound', 'It is required by law'], answer: 1, why: 'A 4K original can be over 40 times larger than a proxy. The EDL lets the online stage rebuild the edit from the originals.' },
    { q: 'What is in an edit decision list?', options: ['The script', 'Each clip’s reel name and its source and record timecodes', 'The actors’ fees', 'The music notes'], answer: 1, why: 'An EDL lists every event: which reel, which part of it (source in and out) and where it goes in the film (record in and out).' },
  ],
  reel: [
    { ms: 5400, caption: 'Flat, ungraded dailies become a locked cut, then the finished, graded film.', set: { stage: 'dailies', play: true, t: 2, ratio: 50 }, anim: { stageK: [0, 5.99] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const set = makeSet({ rigs: ['WIDE', 'CUA', 'CUB'] }); root.add(set.group);
    const shooter = new Shooter(stage, set);
    const prog = makeMonitor(root, shooter, 3.2, 1.8, { label: 'PROGRAM', col: COL.red });
    const pipe = board(root, 3.8, 2.0, 1024, 540, () => {}, null); shooter.hide.push(pipe.mesh);
    const edlB = board(root, 2.6, 1.5, 700, 404, () => {}, null); shooter.hide.push(edlB.mesh);
    // Footage pile: one block per hour shot.
    const N = 400, pile = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.07, 0.16), new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.5, metalness: 0.3 }), N);
    pile.castShadow = true; pile.frustumCulled = false; root.add(pile); shooter.hide.push(pile);
    const pileG = new THREE.Group(); root.add(pileG); shooter.hide.push(pileG);
    const layout = suiteLayout(stage, [
      [prog.group, { pos: [7.05, 3.35, 0.2] }, { pos: [0, 6.35, 0], scale: 1.1 }],
      [pipe.mesh, { pos: [6.95, 1.3, 0.6], rx: -0.28, scale: 0.9 }, { pos: [0, 4.35, 0.2], scale: 0.95, rx: -0.1 }],
      [edlB.mesh, { pos: [3.95, 3.6, 0.1], scale: 0.92 }, null],
    ], this.view, { pos: [0, 4.6, 5.0], target: [0, 3.6, 0] });
    const lPile = stage.label('Footage: 1 block = 1 hour', [4.1, 1.1, -0.2], root);
    const lSet = stage.label('The set', [0, 2.95, -1.6], set.group);
    const tmp = new THREE.Object3D();
    const placePile = (n) => {
      for (let i = 0; i < N; i++) {
        if (i < n) { const layer = Math.floor(i / 60), r = i % 60, x = r % 10, z = Math.floor(r / 10); tmp.position.set(3.45 + x * 0.13, 0.036 + layer * 0.075, -1.0 + z * 0.19); tmp.scale.setScalar(1); }
        else { tmp.position.set(0, -5, 0); tmp.scale.setScalar(0.0001); }
        tmp.updateMatrix(); pile.setMatrixAt(i, tmp.matrix);
      }
      pile.instanceMatrix.needsUpdate = true;
    };

    const seq = PRESETS.speaker.seq;
    const rows = edl(seq);
    const drawEdl = (hl) => {
      const g = edlB.canvas.getContext('2d'), W = 700, H = 404; panelBg(g, W, H);
      text(g, 'EDIT DECISION LIST (CMX 3600 style)', 18, 30, { font: `600 18px ${SANS}`, col: '#e8eef8' });
      text(g, 'EVT  REEL     TRK   TRANS SRC IN      SRC OUT     REC IN      REC OUT', 18, 58, { font: `12.5px ${MONO}`, col: COL.soft });
      rows.slice(3).forEach((r, i) => {
        const y = 84 + i * 26, on = i === hl;
        if (on) { g.fillStyle = 'rgba(255,209,102,.16)'; g.fillRect(12, y - 17, W - 24, 24); }
        text(g, r, 18, y, { font: `12.5px ${MONO}`, col: on ? COL.hot : 'rgba(255,255,255,.85)' });
      });
      wrap(g, 'The online editor uses this list to rebuild the edit from the full-quality camera files.', 18, H - 40, W - 36, 20, { font: `14px ${SANS}`, col: COL.soft });
      edlB.tex.needsUpdate = true;
    };
    const drawPipe = (s) => {
      const g = pipe.canvas.getContext('2d'), W = 1024, H = 540; panelBg(g, W, H);
      const cur = STAGES.findIndex((x) => x.id === s.stage), shot = s.ratio * RUN_H;
      text(g, 'POST-PRODUCTION: HOW LONG IS THE CUT?', 22, 36, { font: `600 22px ${SANS}`, col: '#e8eef8' });
      STAGES.forEach((x, i) => {
        const bx = 22 + i * 166, on = i === cur, done = i < cur;
        g.fillStyle = on ? COL.hot : done ? 'rgba(92,225,169,.35)' : 'rgba(255,255,255,.08)'; rrect(g, bx, 56, 150, 46, 10); g.fill();
        text(g, x.name, bx + 75, 86, { font: `600 18px ${SANS}`, col: on ? '#0b0d12' : '#fff', align: 'center' });
        if (i < 5) text(g, '›', bx + 158, 88, { font: `600 24px ${SANS}`, col: COL.dim });
      });
      // Length bars on a log scale from 1 h to 500 h.
      const x0 = 190, x1 = 990, X = (h) => x0 + (Math.log10(h) / Math.log10(500)) * (x1 - x0);
      STAGES.forEach((x, i) => {
        const h = x.len ?? shot, y = 124 + i * 30, on = i === cur;
        text(g, x.name, 22, y + 17, { font: `${on ? 600 : 400} 15px ${SANS}`, col: on ? COL.hot : 'rgba(255,255,255,.75)' });
        g.fillStyle = on ? COL.hot : i === 0 ? '#7aa2ff' : '#5ce1a9'; rrect(g, x0, y + 4, Math.max(6, X(h) - x0), 18, 4); g.fill();
        text(g, h >= 10 ? `${Math.round(h)} h` : `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`, X(h) + 8, y + 18, { font: `600 14px ${SANS}`, col: '#fff' });
      });
      [1, 10, 100].forEach((v) => { text(g, `${v} h`, X(v) - 8, 318, { font: `12px ${SANS}`, col: COL.dim }); });
      wrap(g, STAGES[cur].what, 22, 346, W - 44, 22, { font: `17px ${SANS}`, col: 'rgba(255,255,255,.85)' });
      // Feature structure.
      const y = 400, L = 22, R = W - 22;
      text(g, s.indian ? 'AN INDIAN FEATURE, ABOUT 2 H 40 MIN (ILLUSTRATIVE)' : 'A 2-HOUR FEATURE (ILLUSTRATIVE)', L, y, { font: `600 15px ${SANS}`, col: COL.soft });
      const total = s.indian ? 160 : 120, Xm = (m) => L + (m / total) * (R - L);
      g.fillStyle = 'rgba(122,162,255,.45)'; rrect(g, L, y + 14, R - L, 40, 6); g.fill();
      if (s.indian) {
        g.fillStyle = COL.bad; g.fillRect(Xm(76), y + 8, 10, 52);
        text(g, 'INTERVAL', Xm(76) + 5, y + 82, { font: `600 14px ${SANS}`, col: COL.bad, align: 'center' });
        g.fillStyle = 'rgba(255,209,102,.7)'; g.fillRect(Xm(66), y + 14, Xm(76) - Xm(66), 40);
        text(g, 'interval block', Xm(66) - 4, y + 82, { font: `13px ${SANS}`, col: COL.hot, align: 'right' });
        [18, 44, 96, 122, 146].forEach((m, i) => { g.fillStyle = '#ff8fc8'; rrect(g, Xm(m), y + 14, Xm(m + 4.5) - Xm(m), 40, 4); g.fill(); if (i === 0) text(g, '♪ songs', Xm(m), y + 82, { font: `13px ${SANS}`, col: '#ff8fc8' }); });
      } else {
        [[0, 'Act 1'], [30, 'Act 2'], [90, 'Act 3']].forEach(([m, t]) => { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(Xm(m), y + 10, 2, 48); text(g, t, Xm(m) + 6, y + 40, { font: `600 14px ${SANS}`, col: '#fff' }); });
      }
      text(g, '0', L, y + 104, { font: `12px ${SANS}`, col: COL.dim }); text(g, `${total} min`, R, y + 104, { font: `12px ${SANS}`, col: COL.dim, align: 'right' });
      pipe.tex.needsUpdate = true;
    };

    let pKey = '', eKey = -2, n = -1, info = {};
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.stageK !== undefined) { const st = STAGES[clamp(Math.floor(s.stageK), 0, 5)].id; if (st !== s.stage) s.stage = st; }
        if (s.play) s.t = (s.t + dt) % DUR;
        const lay = layout();
        const hrs = Math.round(s.ratio * RUN_H);
        if (hrs !== n) { n = hrs; placePile(Math.min(N, hrs)); }
        const pk = `${s.stage}|${hrs}|${s.indian}`;
        if (pk !== pKey) { pKey = pk; drawPipe(s); }
        const si = STAGES.findIndex((x) => x.id === s.stage), stg = STAGES[si];
        // Dailies play one camera's raw take; later stages play the edit.
        const dailies = si === 0;
        const i = clipIndex(seq, s.t), c = dailies ? { cam: 'WIDE', a: 0, src: 0 } : seq[i], srcT = c.src + (s.t - c.a);
        const hl = dailies ? -1 : i; if (hl !== eKey) { eKey = hl; drawEdl(hl); }
        shooter.shoot(prog.rtA, CAMS[c.cam], srcT);
        const offline = si < 5;
        prog.set({ ...stg.look, uPix: offline && s.proxy ? 3 : 0, uMode: 0 });
        Object.entries(set.rigs).forEach(([k, r]) => r.tally(k === c.cam ? 'live' : ''));
        const l = lineAt(srcT), f = Math.round(s.t * 24);
        const tag = dailies ? `DAILIES · ${CAMS.WIDE.roll}C003 · TAKE 3` : `${stg.name.toUpperCase()}${offline && s.proxy ? ' · PROXY' : ''}`;
        prog.overlay(`${tag}|${f}|${l?.text}`, (x, W, H) => drawBurnIn(x, W, H, { tag, tagCol: si === 5 ? COL.mint : COL.hot, tcode: dailies ? tc(srcT, 14) : tc(s.t), sub: l && si >= 1 ? { name: NAMES[l.who], text: l.text, col: l.who === 'A' ? '#ffc2b8' : '#b9f5dc' } : null }));
        info = { hrs, si };
        fitNarrow(stage, [lSet, lPile], -0.05);
        lPile.visible = lay === 'wide' && !fitNarrow(stage, [], -0.05);
      },
      readout(s) {
        if (info.hrs === undefined) return '';
        const h = info.hrs;
        return `<div class="big">${STAGES[info.si].name}</div>
          <div class="row"><span>Footage shot</span><b>${h} hours (${Math.round(s.ratio)} : 1)</b></div>
          <div class="row"><span>Watching it all, 8 h a day</span><b>${Math.ceil(h / 8)} days</b></div>
          <div class="row"><span>As 4K camera originals</span><b>${gb(h * RAW_GBH)}</b></div>
          <div class="row"><span>As HD proxies</span><b class="ok">${gb(h * PROXY_GBH)}</b></div>`;
      },
      dispose() { shooter.dispose(); stage.setShift(0, 0); },
    };
  },
};
