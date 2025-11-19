import * as THREE from 'three';

// small helpers
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;

export function initCameraPresets({ camera, controls, onPresetChange } = {}) {
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

  function setPreset(name) {
    const preset = presets[name] ? name : 'ISO';
    state.preset = preset;
    tweenTo(presets[preset]);
    onPresetChange?.(preset);
  }

  // keyboard shortcuts 1..6
  const keyMap = { '1': 'Front', '2': 'Back', '3': 'Left', '4': 'Right', '5': 'Top', '6': 'ISO' };
  window.addEventListener('keydown', (e) => {
    const name = keyMap[e.key];
    if (name) {
      setPreset(name);
    }
  });

  // go to default
  setPreset(state.preset);

  return {
    set: (name) => setPreset(name),
    presets,
    getPreset: () => state.preset,
    getDuration: () => state.duration,
    setDuration: (ms) => {
      const clamped = THREE.MathUtils.clamp(ms, 100, 10000);
      state.duration = clamped;
      return clamped;
    },
  };
}
