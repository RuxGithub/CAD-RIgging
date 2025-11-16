// motionPlayer.js — tiny CSV motion player (long-form schema)
// time_ms,target,path,axis,value
// 0,Module_A,position,x,0
// 1000,Module_A,position,x,10
// 2000,Module_A,rotation_deg,z,90

import * as THREE from 'three';
import { GUI as LilGUI } from 'three/addons/libs/lil-gui.module.min.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;

function parseCSV(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
}

function indexNodesByName(root) {
  const map = new Map();
  root.traverse((o) => { if (o.name) map.set(o.name, o); });
  return map;
}

function buildTracks(rows) {
  const tracks = new Map(); // key: "target|path|axis" -> [{time,value},...]
  let duration = 0;
  for (const r of rows) {
    const [tStr, target, path, axis, vStr] = r;
    const time = Number(tStr);
    const value = Number(vStr);
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;
    const key = `${target}|${path}|${axis}`;
    if (!tracks.has(key)) tracks.set(key, []);
    tracks.get(key).push({ time, value });
    duration = Math.max(duration, time);
  }
  for (const arr of tracks.values()) arr.sort((a, b) => a.time - b.time);
  return { tracks, duration: Math.max(1, duration) };
}

function sampleTrack(arr, tMs) {
  if (!arr.length) return null;
  if (tMs <= arr[0].time) return arr[0].value;
  if (tMs >= arr[arr.length - 1].time) return arr[arr.length - 1].value;
  let lo = 0, hi = arr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time <= tMs) lo = mid; else hi = mid;
  }
  const a = arr[lo], b = arr[hi];
  const t = (tMs - a.time) / (b.time - a.time);
  return lerp(a.value, b.value, t);
}

function applyAtTime(modelIndex, tracks, tMs) {
  const accum = new Map(); // target -> {pos:[x,y,z], rotD:[x,y,z], scl:[x,y,z]}
  for (const [key, arr] of tracks.entries()) {
    const [target, path, axis] = key.split('|');
    const v = sampleTrack(arr, tMs);
    if (v == null) continue;
    if (!accum.has(target)) accum.set(target, { pos:[, , ], rotD:[, , ], scl:[, , ] });
    const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const a = accum.get(target);
    if (path === 'position') a.pos[i] = v;
    else if (path === 'rotation_deg') a.rotD[i] = v;
    else if (path === 'scale') a.scl[i] = v;
  }

  for (const [target, a] of accum.entries()) {
    const obj = modelIndex.get(target);
    if (!obj) continue;
    if (a.pos.some((c) => c != null)) {
      obj.position.set(a.pos[0] ?? obj.position.x, a.pos[1] ?? obj.position.y, a.pos[2] ?? obj.position.z);
    }
    if (a.rotD.some((c) => c != null)) {
      const rx = (a.rotD[0] ?? THREE.MathUtils.radToDeg(obj.rotation.x)) * Math.PI / 180;
      const ry = (a.rotD[1] ?? THREE.MathUtils.radToDeg(obj.rotation.y)) * Math.PI / 180;
      const rz = (a.rotD[2] ?? THREE.MathUtils.radToDeg(obj.rotation.z)) * Math.PI / 180;
      obj.rotation.set(rx, ry, rz);
    }
    if (a.scl.some((c) => c != null)) {
      obj.scale.set(a.scl[0] ?? obj.scale.x, a.scl[1] ?? obj.scale.y, a.scl[2] ?? obj.scale.z);
    }
  }
}

export function initMotionPlayer({ model, clock, controls }) {
  const modelIndex = indexNodesByName(model);
  let compiled = { tracks: new Map(), duration: 1 };
  let playing = false;
  let loop = true;
  let speed = 1.0;
  let t = 0; // ms

  const gui = new LilGUI({ title: 'Motion' });
  const state = { play: () => playing = true, pause: () => playing = false, stop: () => { playing = false; t = 0; }, speed: 1.0, loop: true, scrub: 0 };
  gui.add(state, 'play'); gui.add(state, 'pause'); gui.add(state, 'stop');
  gui.add(state, 'speed', 0.1, 5, 0.1).onChange((v) => speed = v);
  gui.add(state, 'loop').onChange((v) => loop = v);
  const scrubCtrl = gui.add(state, 'scrub', 0, 1, 0.0001).name('Scrub');

  function loadCSVText(text) {
    const rows = parseCSV(text);
    let dataRows = rows;
    if (rows.length && isNaN(Number(rows[0][0]))) dataRows = rows.slice(1); // drop header
    compiled = buildTracks(dataRows);
    t = 0;
    state.scrub = 0;
    scrubCtrl.setValue(0);
    console.log(`[Motion] Loaded CSV — duration ${compiled.duration} ms, tracks ${compiled.tracks.size}`);
  }

  function attachFileInput(selector) {
    const el = document.querySelector(selector);
    if (!el) { console.warn(`[Motion] File input not found: ${selector}`); return; }
    el.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => loadCSVText(String(reader.result));
      reader.readAsText(f);
    });
  }

  function update() {
    if (!playing) {
      const desired = state.scrub * compiled.duration;
      if (Math.abs(desired - t) > 0.5) {
        t = desired;
        applyAtTime(modelIndex, compiled.tracks, t);
      }
      return;
    }
    const dt = clock ? clock.getDelta() * 1000 : 16.67;
    t += dt * speed;
    if (t > compiled.duration) {
      if (loop) t = t % compiled.duration; else { t = compiled.duration; playing = false; }
    }
    state.scrub = compiled.duration ? t / compiled.duration : 0;
    applyAtTime(modelIndex, compiled.tracks, t);
    controls?.update?.();
  }

  return { update, attachFileInput, loadCSVText, getState: () => ({ playing, loop, speed, t, duration: compiled.duration }) };
}
