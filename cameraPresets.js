import * as THREE from 'three';
import { GUI as LilGUI } from 'three/addons/libs/lil-gui.module.min.js';

// small helpers
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;

export function initCameraPresets({ camera, controls }) {
  const gui = new LilGUI({ title: 'Camera' });

  // sensible defaults; tweak distances to your model size if needed
  const presets = {
    Front: { pos: new THREE.Vector3(0, 0, 0.4), target: new THREE.Vector3(0, 0, 0) },
    Back:  { pos: new THREE.Vector3(0, 0, -0.4), target: new THREE.Vector3(0, 0, 0) },
    Left:  { pos: new THREE.Vector3(-0.4, 0, 0), target: new THREE.Vector3(0, 0, 0) },
    Right: { pos: new THREE.Vector3(0.4, 0, 0), target: new THREE.Vector3(0, 0, 0) },
    Top:   { pos: new THREE.Vector3(0, 0.4, 0), target: new THREE.Vector3(0, 0, 0) },
    ISO:   { pos: new THREE.Vector3(0.2, 0.2, 0.2), target: new THREE.Vector3(0, 0, 0) },
  };

  const state = { preset: 'ISO', duration: 500 };
  gui.add(state, 'preset', Object.keys(presets)).name('Preset').onChange((k) => tweenTo(presets[k]));
  gui.add(state, 'duration', 100, 3000, 50).name('Tween (ms)');

  function tweenTo({ pos, target }) {
    const startPos = camera.position.clone();
    const startTgt = controls.target.clone();
    const endPos = pos.clone();
    const endTgt = target.clone();
    const start = performance.now();
    const dur = state.duration;

    function step(now) {
      const t = clamp01((now - start) / dur);
      camera.position.set(
        lerp(startPos.x, endPos.x, t),
        lerp(startPos.y, endPos.y, t),
        lerp(startPos.z, endPos.z, t),
      );
      controls.target.set(
        lerp(startTgt.x, endTgt.x, t),
        lerp(startTgt.y, endTgt.y, t),
        lerp(startTgt.z, endTgt.z, t),
      );
      controls.update();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // keyboard shortcuts 1..6
  const keyMap = { '1': 'Front', '2': 'Back', '3': 'Left', '4': 'Right', '5': 'Top', '6': 'ISO' };
  window.addEventListener('keydown', (e) => {
    const name = keyMap[e.key];
    if (name) {
      state.preset = name;
      gui.controllers?.[0]?.setValue?.(name);
      tweenTo(presets[name]);
    }
  });

  // go to default
  tweenTo(presets[state.preset]);

  return {
    set: (name) => tweenTo(presets[name] ?? presets.ISO),
    presets,
  };
}
