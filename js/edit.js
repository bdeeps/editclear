// Shared parts for EditClear: a tiny editing suite built in 3D.
//  - a café set with two faceless mannequins (Asha and Kabir) who act out one short, original scene;
//  - virtual cine cameras (the "set-ups") that film that scene live into render targets;
//  - monitors (source and program) whose shader can cut, dissolve, fade and wipe between two shots;
//  - a timeline board (picture and dialogue tracks, playhead) you can scrub and drag cut points on;
//  - small helpers for sequences (clips on a timeline), timecode and the edit decision list.
//
// All footage in this box is rendered live from these little 3D scenes. The scene, lines and characters
// are original to EditClear; nothing copies a real film's frames, script or characters.
//
// Scenes are built in metres: +x right, +y up, +z towards the default viewer. The set's table is at the
// origin. The "180-degree line" runs along x through Asha (x < 0) and Kabir (x > 0); every camera in the
// normal coverage sits on the +z side of it.
//
// Lenses: a Super 35 sensor used at 16:9 is about 24.9 × 14.0 mm (ARRI Alexa 35 / RED Super 35 class), so a
// lens of focal length f gives a vertical field of view of 2·atan(7 / f): 24 mm → 32.5°, 50 mm → 15.9°.
// Timecode runs at 24 frames a second, the cinema standard (SMPTE ST 12-1).
import { THREE, M, box, beam, sphere, clamp, lerp, smooth } from './kit.js';

export const D2R = Math.PI / 180;
export const TAU = Math.PI * 2;
export const FPS = 24;
export const SENSOR_H = 14.0;                       // mm, Super 35 at 16:9
export const vfov = (f) => 2 * Math.atan(SENSOR_H / 2 / f) / D2R;   // degrees

// ---------------------------------------------------------------- boards
export const COL = {
  c: '#38bdf8', hot: '#ffd166', warm: '#ffb547', red: '#ff5a6e', good: '#7be08c', bad: '#ff5a8a',
  violet: '#c49bff', mint: '#5ce1a9', soft: 'rgba(255,255,255,.62)', dim: 'rgba(255,255,255,.4)',
  A: '#ff8a7a', B: '#5ce1a9',
};
export const SANS = 'Geist, system-ui, sans-serif';
export const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.93)'; g.fillRect(0, 0, w, h); }
export function rrect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function text(g, s, x, y, { font = `18px ${SANS}`, col = 'rgba(255,255,255,.82)', align = 'left' } = {}) {
  g.font = font; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left';
}
export function wrap(g, s, x, y, maxW, lh, opts = {}) {
  g.font = opts.font || `18px ${SANS}`;
  const words = s.split(' '); let line = '', yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { text(g, line, x, yy, opts); line = w; yy += lh; } else line = t;
  }
  if (line) text(g, line, x, yy, opts);
  return yy + lh;
}
export function board(root, w, h, pxW, pxH, draw, pos) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = (...a) => { draw(g, pxW, pxH, ...a); tex.needsUpdate = true; };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  if (pos) m.position.set(...pos);
  root.add(m);
  redraw();
  return { tex, redraw, canvas: c, mesh: m, w, h };
}

// ---------------------------------------------------------------- stage helpers
export const inReel = () => document.body.classList.contains('gb-reel');
export const tallStage = (stage) => stage.host.clientWidth / Math.max(1, stage.host.clientHeight) < 0.9;
export const narrowStage = (stage) => stage.host.clientWidth < 560;
export function fitNarrow(stage, minor = [], y0 = -0.1) {
  const narrow = narrowStage(stage);
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const y = narrow && !inReel() ? y0 : 0;
  if (!stage.shift || stage.shift[1] !== y) stage.setShift(0, y);
  return narrow;
}
// Move a range slider in the side panel without firing its handler (for the playhead while playing).
export function quietSlider(label, value) {
  const inp = [...document.querySelectorAll('#panel input[type=range]')].find((x) => x.getAttribute('aria-label') === label);
  if (!inp) return;
  inp.value = value;
  inp.style.setProperty('--p', ((value - inp.min) / (inp.max - inp.min)) * 100 + '%');
  const out = inp.closest('.ctl')?.querySelector('output'); if (out) out.textContent = `${(+value).toFixed(1)} s`;
}
// Set a control as if the viewer moved it, so the readout and UI stay in step.
export function setControl(label, value) {
  const inp = [...document.querySelectorAll('#panel input[type=range]')].find((x) => x.getAttribute('aria-label') === label);
  if (inp) { inp.value = value; inp.dispatchEvent(new Event('input')); return true; }
  const b = [...document.querySelectorAll('#panel .seg')].find((x) => x.getAttribute('aria-label') === label)?.querySelector(`button[data-v="${value}"]`);
  if (b) { b.click(); return true; }
  return false;
}
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- timecode
// 01:00:04:12 means 1 hour, 0 minutes, 4 seconds and 12 frames (of 24). Programmes start at 01:00:00:00.
export function tc(sec, startH = 1) {
  const f = Math.max(0, Math.round(sec * FPS)), ff = f % FPS, S = Math.floor(f / FPS);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(startH + Math.floor(S / 3600))}:${p(Math.floor(S / 60) % 60)}:${p(S % 60)}:${p(ff)}`;
}

// ---------------------------------------------------------------- people
// A faceless mannequin, feet at the origin, facing +x. s = 1 is about 1.75 m tall. It can sit, walk,
// turn its head, talk (a small nod and hand gesture) and reach. +z is its right-hand side.
export function makePerson({ shirt = 0x3b6fd8, pants = 0x2b3242, skin = 0xa87a55, hair = 0x1c1a1a, s = 1, bun = false } = {}) {
  const g = new THREE.Group(), pelvis = new THREE.Group(), body = new THREE.Group();
  g.add(pelvis); pelvis.add(body);
  const cloth = M.matte(shirt), trousers = M.matte(pants), sk = M.matte(skin, { roughness: 0.6 }), hr = M.matte(hair);
  const hipY = 0.9 * s, T = 0.44 * s, SH = 0.46 * s;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * s, 0.36 * s, 6, 14), cloth); torso.position.y = 0.3 * s; torso.scale.z = 1.25; torso.castShadow = true; body.add(torso);
  const hipM = new THREE.Mesh(new THREE.CapsuleGeometry(0.15 * s, 0.1 * s, 6, 12), trousers); hipM.scale.z = 1.3; hipM.position.y = 0.02 * s; body.add(hipM);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.05 * s, 0.1 * s, 10), sk); neck.position.y = 0.62 * s; body.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.7 * s; body.add(headG);
  const head = sphere(0.11 * s, sk, 24); head.scale.set(0.95, 1.12, 0.95); head.position.y = 0.07 * s; headG.add(head);
  const nose = sphere(0.022 * s, sk, 10); nose.position.set(0.1 * s, 0.07 * s, 0); headG.add(nose);
  // Hair covers the back and top of the head, so you can always tell which way a mannequin faces.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118 * s, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hr);
  cap.scale.set(0.95, 1.12, 0.95); cap.position.y = 0.075 * s; cap.rotation.z = 0.35; cap.castShadow = true; headG.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.117 * s, 24, 12, Math.PI * 1.45, Math.PI * 1.1, Math.PI * 0.2, Math.PI * 0.42), hr);
  back.scale.set(0.95, 1.12, 0.95); back.position.y = 0.075 * s; headG.add(back);
  if (bun) { const b = sphere(0.055 * s, hr, 14); b.position.set(-0.11 * s, 0.14 * s, 0); headG.add(b); }
  const limb = (len, r, mat) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 10), mat); m.position.y = -len / 2; m.castShadow = true; p.add(m); return p; };
  const arms = [-1, 1].map((z) => {
    const up = limb(0.3 * s, 0.05 * s, cloth); up.position.set(0, 0.52 * s, z * 0.22 * s); body.add(up);
    const fore = limb(0.3 * s, 0.045 * s, sk); fore.position.y = -0.3 * s; up.add(fore);
    const hand = sphere(0.05 * s, sk, 12); hand.position.y = -0.3 * s; fore.add(hand);
    up.fore = fore; up.hand = hand; return up;
  });
  const legs = [-1, 1].map((z) => {
    const th = limb(T, 0.07 * s, trousers); th.position.set(0, 0, z * 0.1 * s); pelvis.add(th);
    const sh = limb(SH, 0.06 * s, trousers); sh.position.y = -T; th.add(sh);
    const shoe = box(0.22 * s, 0.07 * s, 0.1 * s, M.matte(0x2a2420)); shoe.position.set(0.05 * s, -SH + 0.035 * s, 0); sh.add(shoe);
    th.shin = sh; return th;
  });
  // sit 0..1 (seat height seatH), floor 0..1 (sitting on the floor, legs straight out), walk phase + stride.
  g.pose = ({ sit = 0, seatH = 0.46, floor = 0, walk = 0, stride = 0, yaw = 0, pitch = 0, armL = 0, armR = armL, elbowL = 0, elbowR = elbowL, spreadR = 0, lean = 0 } = {}) => {
    const seatY = seatH + 0.06 * s, floorY = 0.08 * s;
    pelvis.position.y = lerp(lerp(hipY, seatY, sit), floorY, floor) - Math.abs(Math.sin(walk)) * 0.015 * stride;
    const fold = Math.PI / 2 * Math.max(sit, floor);
    legs.forEach((th, i) => {
      const ph = walk + i * Math.PI;
      th.rotation.z = fold + Math.sin(ph) * 0.42 * stride;
      th.shin.rotation.z = -Math.PI / 2 * sit - Math.max(0, Math.sin(ph + 1.2)) * 0.55 * stride;
    });
    arms[0].rotation.z = armL - Math.sin(walk) * 0.35 * stride; arms[1].rotation.z = armR + Math.sin(walk) * 0.35 * stride;
    arms[1].rotation.x = -spreadR;
    arms[0].fore.rotation.z = elbowL; arms[1].fore.rotation.z = elbowR;
    body.rotation.z = -lean;
    headG.rotation.set(0, clamp(yaw, -1.3, 1.3), clamp(pitch, -0.7, 0.8));
  };
  g.pose();
  g.head = head; g.headG = headG; g.body = body; g.arms = arms; g.s = s;
  g.eye = (v = new THREE.Vector3()) => { g.updateMatrixWorld(true); return head.getWorldPosition(v); };
  g.nose = (v = new THREE.Vector3()) => { g.updateMatrixWorld(true); return nose.getWorldPosition(v); };
  // Head yaw/pitch (in the body's frame) that points the face at world point p.
  g.lookAt3 = (p, bodyYaw = g.rotation.y) => {
    const e = g.eye(); const dx = p.x - e.x, dz = p.z - e.z, dy = p.y - e.y;
    return { yaw: wrapAng(Math.atan2(-dz, dx) - bodyYaw), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  };
  return g;
}

// ---------------------------------------------------------------- the scene
// Five lines of original dialogue, then Asha stands, walks to the door and pulls it open.
// Times are seconds of the performance. Every set-up is assumed to record the same performance (in a real
// shoot each set-up is a separate take, and the editor matches them up).
export const DUR = 18;
export const LINES = [
  { who: 'A', t0: 0.4, t1: 2.8, text: 'You still come here?' },
  { who: 'B', t0: 3.3, t1: 6.2, text: 'Every Sunday. Same table.' },
  { who: 'A', t0: 6.7, t1: 9.0, text: 'Even after everything?' },
  { who: 'B', t0: 9.6, t1: 12.0, text: 'Especially after everything.' },
  { who: 'A', t0: 12.6, t1: 14.4, text: 'Then save me a seat.' },
];
export const NAMES = { A: 'Asha', B: 'Kabir' };
export const lineAt = (t) => LINES.find((l) => t >= l.t0 && t < l.t1) || null;
// The door and Asha's route (see pose): stand 13.0–13.8, walk 13.8–15.6, reach 15.6–16.0, pull 16.0–17.6.
export const DOOR = { hinge: [1.75, -1.66], w: 0.8, open: 85 };
export const doorAngle = (t) => DOOR.open * smooth((t - 16.0) / 1.6);          // degrees
const ROUTE = [[-0.8, 0], [-0.72, -0.72], [0.52, -1.08]];
const CUP_A = [-0.2, 0.05], CUP_B = [0.22, -0.06], TABLE_H = 0.74, CLOCK = [-0.15, 2.15, -1.64], WINDOW = [-1.5, 1.55, -1.645];

// Sky colour through the window by hour of day.
const SKY = [[0, 0x0b1026], [5.5, 0x1b2242], [6.5, 0xf0a48a], [8, 0xbfd8f2], [12, 0xd8ecff], [16, 0xf6d9a0], [18, 0xf29a62], [19.2, 0x5b4a8a], [20.5, 0x141a3a], [24, 0x0b1026]];
function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  for (let i = 0; i < SKY.length - 1; i++) if (h <= SKY[i + 1][0]) { const k = (h - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]); return new THREE.Color(SKY[i][1]).lerp(new THREE.Color(SKY[i + 1][1]), k); }
  return new THREE.Color(SKY[0][1]);
}

function checker() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#2a2724' : '#d8cfbd'; x.fillRect(i * 32, j * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.5, 2); return t;
}
function clockFace() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f4efe2'; x.beginPath(); x.arc(128, 128, 124, 0, TAU); x.fill();
  x.strokeStyle = '#1d1b19'; x.lineWidth = 8; x.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.lineWidth = i % 3 ? 4 : 9; x.beginPath(); x.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); x.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A small wooden chair facing +x.
function makeChair(color = 0x6b4a2e) {
  const g = new THREE.Group(), wood = M.matte(color, { roughness: 0.7 });
  const seat = box(0.42, 0.04, 0.42, wood); seat.position.y = 0.44; g.add(seat);
  for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) { const l = box(0.035, 0.44, 0.035, wood); l.position.set(x, 0.22, z); g.add(l); }
  for (const z of [-0.18, 0.18]) { const p = box(0.035, 0.5, 0.035, wood); p.position.set(-0.19, 0.7, z); g.add(p); }
  const back = box(0.03, 0.16, 0.4, wood); back.position.set(-0.19, 0.86, 0); g.add(back);
  return g;
}
function makeCupMesh(color = 0xf2efe8) {
  const g = new THREE.Group(), mat = M.plastic(color, { roughness: 0.25 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.07, 28, 1, true), M.plastic(color, { roughness: 0.25, side: THREE.DoubleSide })); cup.position.y = 0.045; cup.castShadow = true; g.add(cup);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), mat); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.011; g.add(bottom);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.037, 28), M.matte(0x7a4520)); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.068; g.add(tea);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 16, Math.PI), mat); handle.position.set(0.042, 0.045, 0); handle.rotation.z = -Math.PI / 2; g.add(handle);
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.01, 28), mat); saucer.position.y = 0.005; g.add(saucer);
  g.rimY = 0.08; g.rimR = 0.04;
  return g;
}
// A cine camera with its lens along +x on a tripod; tally light turns red when "live".
export function makeCamRig(color = 0x2a2d34) {
  const rig = new THREE.Group(), cam = new THREE.Group(); rig.add(cam);
  const dark = M.matte(color), metal = M.metal(0x9aa3b2, { roughness: 0.35 });
  cam.add(box(0.3, 0.2, 0.16, dark));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.18, 20), M.matte(0x16181d)); lens.rotation.z = -Math.PI / 2; lens.position.x = 0.24; cam.add(lens);
  const matte = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.08, 4, 1, true), M.matte(0x111216, { side: THREE.DoubleSide })); matte.rotation.z = -Math.PI / 2; matte.rotation.x = Math.PI / 4; matte.position.x = 0.37; cam.add(matte);
  const handle = box(0.22, 0.03, 0.03, metal); handle.position.y = 0.15; cam.add(handle);
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20), dark); mag.rotation.x = Math.PI / 2; mag.position.set(-0.05, 0.08, 0.1); cam.add(mag);
  const tally = sphere(0.03, M.glow(0x442222), 10); tally.position.set(0.06, 0.13, 0); cam.add(tally);
  const legs = []; for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6), M.metal(0x3a3f4b)); rig.add(l); legs.push(l); }
  rig.aim = (spec) => {
    const P = new THREE.Vector3(...spec.pos), Tg = new THREE.Vector3(...spec.target);
    rig.position.set(P.x, 0, P.z); cam.position.set(0, P.y, 0);
    const d = Tg.clone().sub(P);
    cam.rotation.set(0, Math.atan2(-d.z, d.x), Math.atan2(d.y, Math.hypot(d.x, d.z)), 'YZX');
    legs.forEach((l, i) => { const a = i * 2.1 + 0.4; const foot = new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), top = new THREE.Vector3(0, P.y - 0.1, 0); l.position.copy(foot).add(top).multiplyScalar(0.5); l.scale.y = Math.max(0.01, foot.distanceTo(top)); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.sub(foot).normalize()); });
  };
  rig.tally = (state) => { tally.material.color.setHex(state === 'live' ? 0xff2a3a : state === 'src' ? 0x38bdf8 : 0x442222); };
  return rig;
}

// Camera set-ups. pos/target in metres, f = focal length in mm. col: colour on the timeline.
export const CAMS = {
  WIDE: { name: 'Wide master', short: 'WIDE', pos: [0.2, 1.35, 4.0], target: [0.3, 1.05, -0.5], f: 24, col: '#7aa2ff', roll: 'A001' },
  CUA: { name: 'Close-up: Asha', short: 'CU ASHA', pos: [0.55, 1.32, 1.25], target: [-0.78, 1.26, 0], f: 60, col: COL.A, roll: 'B001' },
  CUB: { name: 'Close-up: Kabir', short: 'CU KABIR', pos: [-0.55, 1.32, 1.25], target: [0.78, 1.26, 0], f: 60, col: COL.B, roll: 'C001' },
  CUBX: { name: 'Close-up: Kabir (wrong side)', short: 'CU KABIR ✗', pos: [-0.55, 1.32, -1.25], target: [0.78, 1.26, 0], f: 60, col: COL.red, roll: 'C002' },
  DOOR: { name: 'Medium: the door', short: 'MS DOOR', pos: [0.05, 1.42, 0.55], target: [1.0, 1.15, -1.45], f: 24, col: '#8ef0ff', roll: 'B002' },
  CLOCK: { name: 'Her view: the clock', short: 'POV CLOCK', pos: [-0.5, 1.3, 0.25], target: [CLOCK[0], CLOCK[1], CLOCK[2]], f: 50, col: COL.hot, roll: 'B003' },
  CUP: { name: 'Top shot: her cup', short: 'TOP CUP', pos: [CUP_A[0], TABLE_H + 0.08 + 0.41, CUP_A[1] + 0.0001], target: [CUP_A[0], TABLE_H, CUP_A[1]], f: 50, col: COL.violet, up: [0, 0, -1], roll: 'D001' },
  WINDOW: { name: 'The window', short: 'WINDOW', pos: [-0.9, 1.45, 0.6], target: [WINDOW[0], WINDOW[1], WINDOW[2]], f: 32, col: '#ffe08a', roll: 'D002' },
  KFACE: { name: 'Close-up: Kabir, neutral', short: 'CU KABIR', pos: [-0.3, 1.3, 0.22], target: [0.78, 1.24, 0], f: 38, col: COL.B, roll: 'K001' },
  SOUP: { name: 'Insert: a bowl of soup', short: 'SOUP', pos: [-3.25, 1.2, 1.7], target: [-4.3, 0.64, 1.7], f: 35, col: COL.warm, roll: 'K002' },
  CHILD: { name: 'Insert: a child playing', short: 'CHILD', pos: [-3.05, 0.75, 0], target: [-4.3, 0.34, 0], f: 28, col: '#ff8fc8', roll: 'K003' },
  COFFIN: { name: 'Insert: a coffin', short: 'COFFIN', pos: [-3.0, 1.35, -1.7], target: [-4.3, 0.62, -1.7], f: 28, col: '#b0b8c8', roll: 'K004' },
};
// The wide set-up swung round the room by deg degrees (for jump cuts and the 30-degree rule).
export function camSwing(base, deg, extra = {}) {
  const P = new THREE.Vector3(...base.pos), piv = new THREE.Vector3(0.3, 0, -0.5), a = deg * D2R;
  const d = P.clone().sub(piv), x = d.x * Math.cos(a) + d.z * Math.sin(a), z = -d.x * Math.sin(a) + d.z * Math.cos(a);
  return { ...base, ...extra, pos: [piv.x + x, P.y, piv.z + z] };
}

export function makeSet({ inserts = false, rigs = [] } = {}) {
  const g = new THREE.Group();
  const rtOnly = [], crew = [];
  // Floor, back wall with a door and a window, side walls (only seen by the film cameras).
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 4), [M.matte(0x3a3530), M.matte(0x3a3530), new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.6 }), M.matte(0x3a3530), M.matte(0x3a3530), M.matte(0x3a3530)]);
  floor.position.set(0, -0.025, 0.3); floor.receiveShadow = true; g.add(floor);
  const cream = M.matte(0xd9c9a6), teal = M.matte(0x2f6b66), trim = M.matte(0x5a3f28);
  const wall = (w, h, x, y, mat = cream) => { const m = box(w, h, 0.1, mat); m.position.set(x, y, -1.7); g.add(m); return m; };
  wall(3.45, 1.8, -0.775, 1.9); wall(0.75, 1.8, 2.125, 1.9); wall(0.8, 0.75, 1.35, 2.425);
  wall(3.45, 1.0, -0.775, 0.5, teal); wall(0.75, 1.0, 2.125, 0.5, teal);
  const rail = box(3.45, 0.05, 0.14, trim); rail.position.set(-0.775, 1.0, -1.66); g.add(rail);
  const rail2 = box(0.75, 0.05, 0.14, trim); rail2.position.set(2.125, 1.0, -1.66); g.add(rail2);
  const front = box(5, 2.8, 0.1, cream); front.position.set(0, 1.4, 2.3); g.add(front); front.visible = false;
  for (const x of [-2.5, 2.5]) { const sw = box(0.1, 2.8, 4, cream); sw.position.set(x, 1.4, 0.3); g.add(sw); rtOnly.push(sw); const sw2 = box(0.1, 1.0, 4, teal); sw2.position.set(x * 0.998, 0.5, 0.3); g.add(sw2); rtOnly.push(sw2); }
  // Door on a hinge at its right edge; opens into the room. Bright day outside.
  const hinge = new THREE.Group(); hinge.position.set(DOOR.hinge[0], 0, DOOR.hinge[1]); g.add(hinge);
  const doorMesh = box(DOOR.w, 2.02, 0.05, M.matte(0x7a3b2a)); doorMesh.position.set(-DOOR.w / 2, 1.01, 0); hinge.add(doorMesh);
  const pane = box(0.4, 0.55, 0.055, M.glow(0xfff0c8)); pane.position.set(-DOOR.w / 2, 1.5, 0); hinge.add(pane);
  const knob = sphere(0.035, M.metal(0xd8c070), 10); knob.position.set(-DOOR.w + 0.1, 1.0, 0.05); hinge.add(knob);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), M.glow(0xffecc4)); outside.position.set(1.35, 1.3, -2.4); g.add(outside);
  const step = box(1.2, 0.05, 0.8, M.matte(0xb8b0a0)); step.position.set(1.35, -0.02, -2.1); g.add(step);
  // Window: a glowing sky whose colour follows the hour, with a frame.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), M.glow(0xf6d9a0)); sky.position.set(...WINDOW); g.add(sky);
  const frameM = M.matte(0xf2ede0);
  [[1.08, 0.06, 0, 0.53], [1.08, 0.06, 0, -0.53], [0.06, 1.08, 0.53, 0], [0.06, 1.08, -0.53, 0], [1.0, 0.035, 0, 0], [0.035, 1.0, 0, 0]].forEach(([w, h, x, y]) => { const b = box(w, h, 0.04, frameM); b.position.set(WINDOW[0] + x, WINDOW[1] + y, -1.63); g.add(b); });
  // Clock with hands.
  const clock = new THREE.Group(); clock.position.set(...CLOCK); g.add(clock);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.5 })); face.position.z = 0.012; clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 8, 40), M.metal(0x3a3f4b)); rim.position.z = 0.012; clock.add(rim);
  const hHand = new THREE.Group(), mHand = new THREE.Group(); hHand.position.z = 0.02; mHand.position.z = 0.024; clock.add(hHand, mHand);
  const hh = box(0.018, 0.1, 0.006, M.matte(0x111111)); hh.position.y = 0.045; hHand.add(hh);
  const mh = box(0.012, 0.155, 0.006, M.matte(0x111111)); mh.position.y = 0.07; mHand.add(mh);
  // Table, chairs, cups and a pendant lamp.
  const wood = M.matte(0x5a3a22, { roughness: 0.55 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 40), wood); top.position.y = TABLE_H - 0.02; top.castShadow = top.receiveShadow = true; g.add(top);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, TABLE_H - 0.04, 12), M.metal(0x2a2d34)); ped.position.y = (TABLE_H - 0.04) / 2; g.add(ped);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 24), M.metal(0x2a2d34)); foot.position.y = 0.015; g.add(foot);
  const chairA = makeChair(); chairA.position.set(-0.8, 0, 0); g.add(chairA);
  const chairB = makeChair(); chairB.position.set(0.8, 0, 0); chairB.rotation.y = Math.PI; g.add(chairB);
  const cupA = makeCupMesh(0xf2efe8); cupA.position.set(CUP_A[0], TABLE_H, CUP_A[1]); g.add(cupA);
  const cupB = makeCupMesh(0xe8d8b8); cupB.position.set(CUP_B[0], TABLE_H, CUP_B[1]); g.add(cupB);
  const extra = [[0.05, 0.25], [-0.05, -0.26], [0.26, 0.2], [-0.28, -0.2], [0.02, 0.0], [0.3, -0.25]].map(([x, z], i) => { const c = makeCupMesh(i % 2 ? 0xe8d8b8 : 0xf2efe8); c.position.set(x, TABLE_H, z); g.add(c); return c; });
  const cord = beam([0, 2.8, 0], [0, 2.05, 0], 0.006, M.matte(0x111111), 6); g.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 24, 1, true), M.matte(0x2f6b66, { side: THREE.DoubleSide })); shade.position.y = 1.96; g.add(shade);
  const bulb = sphere(0.05, M.glow(0xffe2a8), 12); bulb.position.y = 1.9; g.add(bulb);
  const lamp = new THREE.PointLight(0xffd79a, 2.2, 6, 1.4); lamp.position.set(0, 1.85, 0); g.add(lamp);
  // The two actors.
  const asha = makePerson({ shirt: 0xc8463e, pants: 0x2f3348, skin: 0x9c6b4a, hair: 0x15110f, bun: true, s: 0.96 });
  const kabir = makePerson({ shirt: 0x3a6fb8, pants: 0x3a3a3a, skin: 0xb07e58, hair: 0x201812 });
  g.add(asha, kabir);

  // Kuleshov inserts: three little stages outside the room's left wall, each with a backdrop.
  const ins = {};
  if (inserts) {
    const flat = (z, col) => { const f = box(0.06, 2.0, 1.7, M.matte(col)); f.position.set(-5.15, 1.0, z); g.add(f); const fl = box(2.2, 0.04, 1.6, M.matte(0x3d3934)); fl.position.set(-4.1, 0.0, z); g.add(fl); };
    flat(1.7, 0x4b3b30); flat(0, 0x3b4a5a); flat(-1.7, 0x2a2a30);
    // Soup: a small table, a bowl with steam, a spoon and bread.
    const soup = new THREE.Group(); soup.position.set(-4.3, 0, 1.7); g.add(soup);
    const st = box(0.7, 0.04, 0.6, M.matte(0x6b4a2e)); st.position.y = 0.58; soup.add(st);
    const sl = box(0.06, 0.56, 0.06, M.matte(0x6b4a2e)); sl.position.y = 0.28; soup.add(sl);
    const bowlPts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; bowlPts.push(new THREE.Vector2(0.03 + Math.sin(a) * 0.09, 0.6 + (1 - Math.cos(a)) * 0.08)); }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 32), M.plastic(0xe9e2d2, { side: THREE.DoubleSide })); bowl.castShadow = true; soup.add(bowl);
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.105, 32), M.matte(0xd98b2b, { roughness: 0.3 })); liquid.rotation.x = -Math.PI / 2; liquid.position.y = 0.665; soup.add(liquid);
    const spoon = box(0.2, 0.008, 0.02, M.metal(0xc0c4cc)); spoon.position.set(0.02, 0.605, 0.15); spoon.rotation.y = 0.3; soup.add(spoon);
    const bread = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 10), M.matte(0xc8914a)); bread.rotation.z = Math.PI / 2; bread.position.set(0.05, 0.62, -0.16); soup.add(bread);
    const steam = []; for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), M.ghost(0xffffff, 0.25)); soup.add(p); steam.push(p); }
    ins.soup = { group: soup, steam };
    // A child on the floor rolling a ball, and a few blocks.
    const childG = new THREE.Group(); childG.position.set(-4.35, 0, 0); g.add(childG);
    const child = makePerson({ shirt: 0xf2b93b, pants: 0x3a6fb8, skin: 0xb07e58, hair: 0x2a1d16, s: 0.55 }); childG.add(child);
    const ball = sphere(0.07, M.plastic(0xe84a5f), 18); childG.add(ball);
    [[0.1, -0.3, 0xe84a5f], [-0.05, -0.36, 0x3a6fb8], [0.02, 0.32, 0x5ce1a9]].forEach(([x, z, c]) => { const b = box(0.07, 0.07, 0.07, M.plastic(c)); b.position.set(x + 0.35, 0.035, z); b.rotation.y = x * 5; childG.add(b); });
    ins.child = { group: childG, child, ball };
    // A closed coffin on trestles, with a marigold garland and two candles.
    const cof = new THREE.Group(); cof.position.set(-4.3, 0, -1.7); g.add(cof);
    const shape = new THREE.Shape([[-0.18, -0.9], [0.24, -0.9], [0.28, 0.35], [0.2, 0.9], [-0.2, 0.9], [-0.28, 0.35]].map(([x, y]) => new THREE.Vector2(x, y)));
    const coffin = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015 }), M.matte(0x5a3522, { roughness: 0.45 }));
    coffin.rotation.set(-Math.PI / 2, 0, Math.PI / 2); coffin.position.set(0, 0.5, 0); coffin.castShadow = true; cof.add(coffin);
    for (const z of [-0.6, 0.6]) { const tr = box(0.5, 0.5, 0.06, M.matte(0x2a2d34)); tr.position.set(0, 0.25, z); cof.add(tr); }
    const garland = []; for (let i = 0; i < 26; i++) { const a = i / 25 * Math.PI; garland.push(new THREE.Vector3(Math.cos(a) * 0.22, 0.83 + Math.sin(a) * 0.01, Math.sin(a) * 0.3 - 0.1)); }
    garland.forEach((p, i) => { const f = sphere(0.03, M.matte(i % 3 ? 0xf29a1f : 0xf2c21f), 8); f.position.copy(p); cof.add(f); });
    const flames = [];
    for (const z of [-0.95, 0.95]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 12), M.matte(0xf2ede0)); c.position.set(0.25, 0.25, z); cof.add(c); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), M.glow(0xffc86a)); fl.scale.y = 1.8; fl.position.set(0.25, 0.53, z); cof.add(fl); flames.push(fl); }
    ins.coffin = { group: cof, flames };
  }

  // Camera rigs (crew: hidden from every film camera).
  const rigMap = {};
  rigs.forEach((k) => { const r = makeCamRig(); r.aim(CAMS[k]); g.add(r); crew.push(r); rigMap[k] = r; });

  const v = new THREE.Vector3();
  // Pose the whole set at performance time t. o: { hour, cups, alone, gaze, gazeAt, kule, show }
  const pose = (t, o = {}) => {
    t = clamp(t, 0, DUR);
    const hour = o.hour ?? 17.3;
    sky.material.color.copy(skyAt(hour));
    const night = hour > 19.5 || hour < 6 ? 1 : 0;
    lamp.intensity = night ? 3.2 : 2.2;
    const minutes = (hour % 12) * 60 + t / 60 * 10;
    hHand.rotation.z = -minutes / 720 * TAU; mHand.rotation.z = -(minutes % 60) / 60 * TAU;
    extra.forEach((c, i) => { c.visible = i < (o.cups ?? 0); });
    // Door
    hinge.rotation.y = (o.door ?? doorAngle(t)) * D2R;
    // ---- Kabir: seated, watches Asha, talks on his lines.
    kabir.position.set(0.8, 0, 0); kabir.rotation.y = Math.PI;
    const line = lineAt(t), bTalk = line?.who === 'B' && !o.kule && !o.alone ? 1 : 0, aTalk = line?.who === 'A' && !o.kule ? 1 : 0;
    // ---- Asha
    asha.visible = !o.alone && !o.kule;
    let ax = ROUTE[0][0], az = ROUTE[0][1], ary = 0, sit = 1, walk = 0, stride = 0, reach = 0;
    if (!o.hold) {
      sit = 1 - smooth((t - 13.0) / 0.8);
      if (t > 13.4) { const k = clamp((t - 13.4) / 0.6, 0, 1); ary = lerp(0, 1.45, smooth(k)); }
      if (t > 13.8) {
        const k = clamp((t - 13.8) / 1.8, 0, 1), seg = k < 0.4 ? 0 : 1, kk = seg ? (k - 0.4) / 0.6 : k / 0.4;
        const A = ROUTE[seg], B = ROUTE[seg + 1]; ax = lerp(A[0], B[0], kk); az = lerp(A[1], B[1], kk);
        const hd = Math.atan2(-(B[1] - A[1]), B[0] - A[0]); ary = seg === 0 ? lerp(1.45, hd, smooth(kk * 2)) : hd;
        walk = (t - 13.8) * 7.5; stride = k < 1 ? Math.min(1, (t - 13.8) * 3, (15.6 - t) * 3) : 0;
      }
      if (t >= 15.6) {
        ax = ROUTE[2][0]; az = ROUTE[2][1];
        const hd0 = Math.atan2(-(ROUTE[2][1] - ROUTE[1][1]), ROUTE[2][0] - ROUTE[1][0]), hd1 = Math.atan2(0.52, 0.5);
        ary = lerp(hd0, hd1, smooth((t - 15.6) / 0.4));
        reach = smooth((t - 15.6) / 0.4) * (1 - 0.35 * smooth((t - 16.0) / 1.6));
        ax -= smooth((t - 16.2) / 1.2) * 0.12;
      }
    }
    asha.position.set(ax, 0, az); asha.rotation.y = ary;
    const armRest = sit > 0.5 ? { armL: 0.25, elbowL: 1.3 } : { armL: 0, elbowL: 0.1 };
    const bodyA = { sit, walk, stride, armL: armRest.armL, armR: armRest.armL + reach * 1.15, elbowL: armRest.elbowL, elbowR: armRest.elbowL * (1 - reach) + (aTalk ? Math.sin(t * 5.1) * 0.3 : 0), spreadR: reach * 0.15 };
    asha.pose(bodyA);
    kabir.pose({ sit: 1, lean: 0.05 });
    // Gaze: at Kabir while seated, ahead while walking, at the door after; or an override (clock, floor).
    let ag;
    const kHead = kabir.eye(new THREE.Vector3());
    if (o.gaze) {
      const tgt = o.gaze === 'clock' ? new THREE.Vector3(...CLOCK) : new THREE.Vector3(0.1, 0.1, 0.9);
      const a0 = asha.lookAt3(kHead), a1 = asha.lookAt3(tgt), k = smooth((t - (o.gazeAt ?? 0)) / 0.6);
      ag = { yaw: lerp(a0.yaw, a1.yaw, k), pitch: lerp(a0.pitch, a1.pitch, k) };
    } else if (t < 13.2 || o.hold) ag = asha.lookAt3(kHead);
    else if (t < 15.6) ag = { yaw: 0, pitch: -0.1 };
    else ag = asha.lookAt3(new THREE.Vector3(1.05, 1.1, -1.55));
    const nodA = aTalk ? Math.sin(t * 8.3) * 0.05 : 0;
    asha.pose({ ...bodyA, yaw: ag.yaw, pitch: ag.pitch + nodA });
    // Kabir's gaze follows Asha; in the Kuleshov shot he looks just past the lens, neutral.
    const aHead = asha.eye(new THREE.Vector3());
    const kg = o.kule ? { yaw: -0.18, pitch: -0.02 } : kabir.lookAt3(aHead);
    const nodB = bTalk ? Math.sin(t * 7.7) * 0.05 : 0;
    const breath = Math.sin(t * 1.6) * 0.012;
    kabir.pose({ sit: 1, yaw: kg.yaw, pitch: kg.pitch + nodB + breath, armL: 0.25, elbowL: 1.3, elbowR: 1.3 + (bTalk ? Math.sin(t * 4.7) * 0.3 : 0), lean: 0.05 });
    // Inserts
    if (inserts) {
      ins.soup.steam.forEach((p, i) => { const k = ((t * 0.35 + i / ins.soup.steam.length) % 1); p.position.set(Math.sin(i * 2.3 + t) * 0.03 * (1 + k), 0.68 + k * 0.4, Math.cos(i * 1.7 + t * 0.8) * 0.03 * (1 + k)); p.scale.setScalar(0.6 + k * 1.6); p.material.opacity = 0.28 * (1 - k); });
      const ch = ins.child; ch.child.rotation.y = 0; ch.child.position.set(0, 0, 0);
      const bx = 0.45 + Math.sin(t * 1.9) * 0.2; ch.ball.position.set(bx, 0.07, Math.sin(t * 1.3) * 0.08); ch.ball.rotation.z = -bx * 6;
      ch.child.pose({ floor: 1, armL: 0.9 + Math.sin(t * 1.9) * 0.25, elbowL: 0.2, yaw: 0, pitch: -0.35 + Math.sin(t * 1.9) * 0.05 });
      ins.coffin.flames.forEach((f, i) => { f.scale.set(1, 1.6 + Math.sin(t * 13 + i * 2) * 0.25, 1); });
    }
  };
  pose(0);
  // What each film camera must not see.
  const hideForShot = [...crew];
  return { group: g, front, pose, asha, kabir, clock, cupA, sky, hinge, knob, rtOnly, crew: hideForShot, rigs: rigMap, ins, CLOCK, CUP_A, TABLE_H };
}

// ---------------------------------------------------------------- filming
// Renders the stage's own scene from a virtual film camera into a render target.
export class Shooter {
  constructor(stage, set) {
    this.stage = stage; this.set = set;
    this.cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.03, 200);
    this.hide = [...set.crew];
    this.bg = new THREE.Color(0x221e1b);
    this.targets = [];
  }
  target(w = 640, h = 360) { const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); this.targets.push(rt); return rt; }
  aim(spec) {
    const c = this.cam;
    c.fov = vfov(spec.f); c.updateProjectionMatrix();
    c.position.set(...spec.pos); c.up.set(...(spec.up || [0, 1, 0])); c.lookAt(new THREE.Vector3(...spec.target));
    c.updateMatrixWorld(true);
    return c;
  }
  // Pose the set at performance time t with options o, then film it with set-up spec into rt.
  shoot(rt, spec, t, o = {}) {
    const st = this.stage, r = st.renderer, sc = st.scene;
    this.set.pose(t, o);
    this.aim(spec);
    const vis = this.hide.map((x) => x.visible), fl = st.floor.visible, bg = sc.background;
    this.hide.forEach((x) => { x.visible = false; }); this.set.rtOnly.forEach((x) => { x.visible = true; });
    this.set.front.visible = spec.pos[2] < 2.1 && spec.pos[0] > -2.4;
    st.floor.visible = false; sc.background = this.bg;
    r.setRenderTarget(rt); r.clear(); r.render(sc, this.cam); r.setRenderTarget(null);
    this.hide.forEach((x, i) => { x.visible = vis[i]; }); this.set.rtOnly.forEach((x) => { x.visible = false; }); this.set.front.visible = false;
    st.floor.visible = fl; sc.background = bg;
  }
  project(v) { return v.clone().project(this.cam); }
  dispose() { this.targets.forEach((t) => t.dispose()); }
}

// ---------------------------------------------------------------- monitors
// A monitor shows up to two shots (A and B) and mixes them: mode 0 straight, 1 dissolve, 2 fade through
// black, 3 wipe (left to right). uFlat 0..1 shows the flat "log" look of camera originals, uPix blocks
// the picture into big pixels (a low-resolution proxy), uWarm adds a finishing grade.
const MON_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const MON_FS = `
uniform sampler2D tA; uniform sampler2D tB; uniform sampler2D tO;
uniform float uMix, uMode, uFlat, uPix, uWarm, uBright, uFlash;
uniform vec2 uRes;
varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
vec3 enc(vec3 c){ return pow(clamp(c,0.0,1.0), vec3(1.0/2.2)); }
void main(){
  vec2 uv = vUv;
  if (uPix > 1.0) uv = (floor(uv * uRes / uPix) + 0.5) * uPix / uRes;
  vec3 a = texture2D(tA, uv).rgb, b = texture2D(tB, uv).rgb, c = a;
  if (uMode > 0.5 && uMode < 1.5) c = mix(a, b, uMix);
  else if (uMode > 1.5 && uMode < 2.5) c = uMix < 0.5 ? a * (1.0 - uMix * 2.0) : b * ((uMix - 0.5) * 2.0);
  else if (uMode > 2.5) { float e = smoothstep(uMix - 0.03, uMix + 0.03, uv.x); c = mix(b, a, e); float edge = 1.0 - smoothstep(0.0, 0.012, abs(uv.x - uMix)); c += edge * 0.15 * step(0.01, uMix) * step(uMix, 0.99); }
  c = enc(aces(c * 1.25)) * uBright;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 flt = mix(vec3(l), c, 0.55) * 0.62 + 0.2;
  c = mix(c, flt, uFlat);
  vec3 graded = pow(c, vec3(1.08)) * vec3(1.06, 1.0, 0.9);
  c = mix(c, clamp(graded, 0.0, 1.0), uWarm);
  c = mix(c, vec3(1.0), uFlash);
  vec4 o = texture2D(tO, vUv);
  c = mix(c, o.rgb, o.a);
  gl_FragColor = vec4(c, 1.0);
}`;
export function makeMonitor(root, shooter, w, h, { pxW = 640, pxH = 360, label = 'PROGRAM', col = COL.red, pos = [0, 0, 0] } = {}) {
  const g = new THREE.Group(); g.position.set(...pos); root.add(g);
  const bezel = box(w + 0.08, h + 0.08, 0.06, M.matte(0x0d0e12)); bezel.position.z = -0.035; g.add(bezel);
  const rtA = shooter.target(pxW, pxH), rtB = shooter.target(pxW, pxH);
  const ov = document.createElement('canvas'); ov.width = 640; ov.height = 360;
  const og = ov.getContext('2d'), otex = new THREE.CanvasTexture(ov); otex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.ShaderMaterial({
    vertexShader: MON_VS, fragmentShader: MON_FS, toneMapped: false,
    uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, tO: { value: otex }, uMix: { value: 0 }, uMode: { value: 0 }, uFlat: { value: 0 }, uPix: { value: 0 }, uWarm: { value: 0 }, uBright: { value: 1 }, uFlash: { value: 0 }, uRes: { value: new THREE.Vector2(pxW, pxH) } },
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); g.add(screen);
  shooter.hide.push(g);
  // Title strip above the screen.
  const strip = board(g, w, 0.16 * (w / 3.4) + 0.06, 640, Math.round(640 * (0.16 * (w / 3.4) + 0.06) / w), (x, W, H, s = label, c = col) => {
    x.clearRect(0, 0, W, H); x.fillStyle = c; rrect(x, 0, H * 0.18, 14, H * 0.64, 4); x.fill();
    text(x, s, 24, H * 0.72, { font: `600 ${Math.round(H * 0.6)}px ${MONO}`, col: 'rgba(255,255,255,.85)' });
  }, [0, h / 2 + 0.1 * (w / 3.4) + 0.06, 0]);
  let okey = '';
  return {
    group: g, screen, mat, rtA, rtB, strip, w, h,
    set(u) { for (const k in u) mat.uniforms[k].value = u[k]; },
    // Redraw the overlay only when its key changes. draw(g, W, H)
    overlay(key, draw) { if (key === okey) return; okey = key; og.clearRect(0, 0, 640, 360); draw(og, 640, 360); otex.needsUpdate = true; },
  };
}
// Standard overlay: set-up tag top left, timecode top right, subtitle bottom.
export function drawBurnIn(x, W, H, { tag = '', tagCol = '#fff', tcode = '', sub = null, note = '' } = {}) {
  if (tag) { x.font = `600 22px ${MONO}`; const w = x.measureText(tag).width + 24; x.fillStyle = 'rgba(0,0,0,.55)'; rrect(x, 12, 12, w, 34, 6); x.fill(); x.fillStyle = tagCol; x.fillRect(12, 12, 5, 34); text(x, tag, 26, 37, { font: `600 22px ${MONO}`, col: '#fff' }); }
  if (tcode) { x.font = `22px ${MONO}`; const w = x.measureText(tcode).width + 20; x.fillStyle = 'rgba(0,0,0,.55)'; rrect(x, W - w - 12, 12, w, 34, 6); x.fill(); text(x, tcode, W - 22, 37, { font: `22px ${MONO}`, col: '#ffd166', align: 'right' }); }
  if (sub) {
    const s = sub.name ? `${sub.name}: ${sub.text}` : sub.text;
    x.font = `600 26px ${SANS}`; const w = x.measureText(s).width + 28;
    x.fillStyle = 'rgba(0,0,0,.6)'; rrect(x, W / 2 - w / 2, H - 58, w, 42, 8); x.fill();
    text(x, s, W / 2, H - 28, { font: `600 26px ${SANS}`, col: sub.col || '#fff', align: 'center' });
  }
  if (note) { x.font = `600 30px ${SANS}`; const w = x.measureText(note).width + 30; x.fillStyle = 'rgba(0,0,0,.6)'; rrect(x, W / 2 - w / 2, 60, w, 46, 8); x.fill(); text(x, note, W / 2, 93, { font: `600 30px ${SANS}`, col: '#ffd166', align: 'center' }); }
}

// ---------------------------------------------------------------- sequences
// A sequence is a list of clips laid end to end: { cam, a, b, src, o?, tr? }. a..b is record time (on the
// timeline); src is the performance time at a, so the source time at record time T is src + (T - a).
// tr (optional) is the transition INTO this clip: { type: 'dissolve'|'fade'|'wipe', len: seconds }.
export function seqFrom(list) {
  let a = 0;
  return list.map((c) => { const clip = { ...c, a, b: a + c.dur, src: c.src ?? a }; a += c.dur; return clip; });
}
export const seqDur = (seq) => seq.length ? seq[seq.length - 1].b : 0;
export function clipIndex(seq, T) { for (let i = 0; i < seq.length; i++) if (T < seq[i].b) return i; return seq.length - 1; }
// A real-time dialogue edit: cut times (record = performance) and the set-up for each piece.
export function realTime(cuts, cams, dur = DUR) {
  const pts = [0, ...cuts, dur];
  return cams.map((cam, i) => ({ cam, a: pts[i], b: pts[i + 1], src: pts[i] }));
}
export const asl = (seq) => seqDur(seq) / Math.max(1, seq.length);
// The edit decision list, CMX 3600 style: event, reel, track, transition, source in/out, record in/out.
export function edl(seq, title = 'CAFE_SC12') {
  const rows = [`TITLE: ${title}`, 'FCM: NON-DROP FRAME', ''];
  seq.forEach((c, i) => {
    const cam = CAMS[c.cam] || { roll: 'AX' };
    const sIn = 14 * 3600 + (c.src || 0), sOut = sIn + (c.b - c.a);
    const tr = c.tr && c.tr.type === 'dissolve' ? `D ${String(Math.round(c.tr.len * FPS)).padStart(3, '0')}` : 'C    ';
    rows.push(`${String(i + 1).padStart(3, '0')}  ${cam.roll.padEnd(8)} V     ${tr} ${tc(sIn, 0)} ${tc(sOut, 0)} ${tc(c.a)} ${tc(c.b)}`);
  });
  return rows;
}

// ---------------------------------------------------------------- timeline board
// Draws a two-track timeline (V1 picture, A1 dialogue) for a sequence, with the playhead at T.
// opts: { dur, t, audio: [{who,a,b,text}], sel: index of selected clip, marks: [times], hot: index of dragged cut }
export function drawTimeline(g, W, H, seq, opts = {}) {
  panelBg(g, W, H);
  const dur = opts.dur || seqDur(seq), L = 118, R = W - 18, x = (t) => L + (t / dur) * (R - L);
  // Ruler
  text(g, opts.title || 'TIMELINE', 18, 30, { font: `600 18px ${MONO}`, col: COL.soft });
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
  const step = dur > 60 ? 10 : dur > 20 ? 5 : 1;
  for (let s = 0; s <= dur + 1e-6; s += step) { const xx = x(s); g.beginPath(); g.moveTo(xx, 42); g.lineTo(xx, s % (step * 5) === 0 ? 56 : 50); g.stroke(); if (s % (step * 2) === 0 || step >= 5) text(g, `${s}s`, xx + 3, 54, { font: `13px ${MONO}`, col: COL.dim }); }
  const rowV = 66, hV = (H - 66) * 0.46, rowA = rowV + hV + 10, hA = H - rowA - 12;
  text(g, 'V1', 24, rowV + hV / 2 + 8, { font: `600 22px ${MONO}`, col: '#9fb4ff' });
  text(g, 'A1', 24, rowA + hA / 2 + 8, { font: `600 22px ${MONO}`, col: '#9fe8c8' });
  text(g, 'picture', 62, rowV + hV / 2 + 6, { font: `12px ${SANS}`, col: COL.dim });
  text(g, 'dialogue', 62, rowA + hA / 2 + 6, { font: `12px ${SANS}`, col: COL.dim });
  seq.forEach((c, i) => {
    const cam = CAMS[c.cam] || { col: c.col || '#888', short: c.label || c.cam };
    const x0 = x(c.a), x1 = x(c.b);
    g.fillStyle = cam.col; g.globalAlpha = opts.sel === i ? 1 : 0.78; rrect(g, x0 + 1.5, rowV, Math.max(2, x1 - x0 - 3), hV, 6); g.fill(); g.globalAlpha = 1;
    if (opts.sel === i) { g.strokeStyle = '#fff'; g.lineWidth = 3; rrect(g, x0 + 1.5, rowV, Math.max(2, x1 - x0 - 3), hV, 6); g.stroke(); }
    // thumbnail-like band and name
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x0 + 2, rowV + hV * 0.62, Math.max(0, x1 - x0 - 4), hV * 0.38);
    g.save(); g.beginPath(); g.rect(x0 + 2, rowV, Math.max(0, x1 - x0 - 4), hV); g.clip();
    text(g, c.label || cam.short, x0 + 9, rowV + 24, { font: `600 16px ${SANS}`, col: '#0b0d12' });
    g.restore();
    if (c.tr && i > 0) {
      const w = (c.tr.len / dur) * (R - L);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath();
      if (c.tr.type === 'wipe') { g.moveTo(x0 - w / 2, rowV + hV); g.lineTo(x0 + w / 2, rowV); g.lineTo(x0 + w / 2, rowV + hV); }
      else { g.moveTo(x0 - w / 2, rowV + hV * 0.2); g.lineTo(x0 + w / 2, rowV + hV * 0.8); g.lineTo(x0 + w / 2, rowV + hV * 0.2); g.lineTo(x0 - w / 2, rowV + hV * 0.8); }
      g.closePath(); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
    }
    if (i > 0) { g.fillStyle = opts.hot === i ? COL.hot : 'rgba(255,255,255,.9)'; g.fillRect(x0 - 2, rowV - 6, 4, hV + 12); }
  });
  // Dialogue: each line as a waveform block in the speaker's colour.
  (opts.audio || []).forEach((l) => {
    const x0 = x(l.a), x1 = x(l.b), col = l.who === 'A' ? COL.A : l.who === 'B' ? COL.B : l.col || '#9fe8c8';
    g.fillStyle = col; g.globalAlpha = 0.25; rrect(g, x0, rowA, x1 - x0, hA, 5); g.fill(); g.globalAlpha = 0.95;
    const n = Math.max(2, Math.floor((x1 - x0) / 5));
    for (let k = 0; k < n; k++) { const amp = (0.25 + 0.75 * Math.abs(Math.sin(k * 1.7 + l.a * 3) * Math.sin(k * 0.45 + 1))) * hA * 0.42; g.fillRect(x0 + 2 + k * 5, rowA + hA / 2 - amp, 3, amp * 2); }
    g.globalAlpha = 1;
    if (x1 - x0 > 70) text(g, l.who ? NAMES[l.who] || l.who : l.label || '', x0 + 6, rowA + 17, { font: `600 13px ${SANS}`, col: '#fff' });
  });
  (opts.marks || []).forEach((m) => { g.strokeStyle = m.col || COL.hot; g.setLineDash([6, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(x(m.t), rowV - 8); g.lineTo(x(m.t), H - 8); g.stroke(); g.setLineDash([]); if (m.label) text(g, m.label, x(m.t) + 5, H - 12, { font: `600 13px ${SANS}`, col: m.col || COL.hot }); });
  // Playhead
  if (opts.t !== undefined) { const xx = x(clamp(opts.t, 0, dur)); g.fillStyle = COL.red; g.fillRect(xx - 1.5, 40, 3, H - 46); g.beginPath(); g.moveTo(xx - 9, 34); g.lineTo(xx + 9, 34); g.lineTo(xx, 46); g.closePath(); g.fill(); }
  return { x, L, R, rowV, hV, rowA, hA, dur };
}

// Pointer helper: calls onDown(uv, e) → true to start a drag, then onMove(uv), onUp().
export function boardPointer(stage, mesh, { onDown, onMove, onUp }) {
  const el = stage.renderer.domElement, ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  let drag = false;
  const uvAt = (e, any = false) => {
    const b = el.getBoundingClientRect(); v2.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(v2, stage.camera);
    const h = ray.intersectObject(mesh, false)[0];
    if (h) return h.uv;
    if (!any) return null;
    // While dragging off the board, project onto its plane.
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
    const p = ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, mesh.getWorldPosition(new THREE.Vector3())), new THREE.Vector3());
    if (!p) return null;
    const loc = mesh.worldToLocal(p), w = mesh.geometry.parameters.width, h2 = mesh.geometry.parameters.height;
    return new THREE.Vector2(loc.x / w + 0.5, loc.y / h2 + 0.5);
  };
  const down = (e) => { const uv = uvAt(e); if (!uv) return; if (onDown(uv, e)) { drag = true; stage.controls.enabled = false; e.preventDefault(); e.stopPropagation(); } };
  const move = (e) => { if (!drag) return; const uv = uvAt(e, true); if (uv) onMove(uv); };
  const up = () => { if (drag) { drag = false; stage.controls.enabled = true; onUp?.(); } };
  el.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  return () => { el.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); stage.controls.enabled = true; };
}

// ---------------------------------------------------------------- the suite layout
// Places the set on the left and the monitors + timeline on the right (wide screens), or stacks them
// (tall screens and the vertical reel). Returns an updater to call every frame.
export function suiteLayout(stage, parts, wideView, tallView) {
  let last = '';
  return () => {
    const lay = tallStage(stage) ? 'tall' : 'wide';
    if (lay === last) return lay;
    last = lay;
    parts.forEach(([obj, wide, tall]) => {
      const p = lay === 'tall' ? tall : wide;
      if (!p) { obj.visible = false; return; }
      obj.visible = true; obj.position.set(...p.pos); obj.scale.setScalar(p.scale ?? 1); obj.rotation.set(p.rx ?? 0, p.ry ?? 0, 0);
    });
    const v = lay === 'tall' ? tallView : wideView;
    stage.setView(v.pos, v.target, 0.6);
    return lay;
  };
}
// Which way a character faces on screen through a camera: projects eye and nose. Returns -1 left, 1 right.
export function screenFacing(shooter, person) {
  const e = shooter.project(person.eye()), n = shooter.project(person.nose());
  return { eye: e, dir: Math.sign(n.x - e.x) || 1 };
}

export { THREE, M, box, beam, sphere, clamp, lerp, smooth };
