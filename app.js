// ---- basics & scene ----
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f5f7);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.01, 1000);
camera.position.set(2.5, 1.8, 3.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.update();

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 6, 5);
scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));

const grid = new THREE.GridHelper(10, 10);
grid.rotation.x = Math.PI / 2 * 0; // keep Y-up default
scene.add(grid);

// ---- helpers ----
function traverseByNameMap(root) {
  const map = {};
  root.traverse(obj => { if (obj.name) map[obj.name] = obj; });
  return map;
}

function resetLocal(node) {
  node.position.set(0,0,0);
  node.rotation.set(0,0,0);
  node.scale.set(1,1,1);
}

// linear interpolator for sorted time series
function makeSampler(series) {
  const arr = series.slice().sort((a,b)=>a.ts-b.ts);
  const n = arr.length;
  return function(ts) {
    if (n===0) return 0;
    if (ts <= arr[0].ts) return arr[0].val;
    if (ts >= arr[n-1].ts) return arr[n-1].val;
    // binary search
    let lo = 0, hi = n-1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].ts <= ts) lo = mid; else hi = mid;
    }
    const a = arr[lo], b = arr[hi];
    const u = (ts - a.ts) / (b.ts - a.ts);
    return a.val*(1-u) + b.val*u;
  };
}

function degToRad(deg){ return deg * Math.PI / 180; }

// CSV parsing (no libs)
async function loadCSV(url) {
  const txt = await (await fetch(url)).text();
  const lines = txt.trim().split(/\r?\n/);
  const hdr = lines.shift().split(',');
  const idx = Object.fromEntries(hdr.map((h,i)=>[h.trim(), i]));
  return lines.map(line=>{
    const c = line.split(',');
    return {
      ts: +c[idx['timestamp_ms']],
      module: c[idx['module']],
      axis: c[idx['axis']],
      val: +c[idx['position']]
    };
  });
}

async function loadJSON(url) {
  return await (await fetch(url)).json();
}

// build {(module:axis) -> sampler}
function buildSamplers(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const key = `${r.module}:${r.axis}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ ts: r.ts, val: r.val });
  }
  const samplers = new Map();
  for (const [k, arr] of byKey.entries()) samplers.set(k, makeSampler(arr));
  return samplers;
}

// apply transforms per config
function applyTransform(node, adef, value) {
  const v = adef.degrees ? (degToRad(value)) : value;
  if (adef.type === 'translate') {
    // assume local axes = glTF Y-up
    if (adef.axis === 'X') node.position.x += value;
    if (adef.axis === 'Y') node.position.y += value;
    if (adef.axis === 'Z') node.position.z += value;
  } else if (adef.type === 'rotate') {
    if (adef.axis === 'ROT_X') node.rotation.x += v;
    if (adef.axis === 'ROT_Y') node.rotation.y += v;
    if (adef.axis === 'ROT_Z') node.rotation.z += v;
  }
}

// ---- load assets & run ----
const [cfg, csvRows, gltf] = await Promise.all([
  loadJSON('./rig_config.json'),
  loadCSV('./motion.csv'),
  (async () => {
    const loader = new GLTFLoader();
    return await new Promise((res, rej) => loader.load('./assets/model.glb', res, undefined, rej));
  })()
]);

const root = gltf.scene;
scene.add(root);

const nameMap = traverseByNameMap(root);

// OPTIONAL: quick sanity dump
console.log('Scene nodes:', Object.keys(nameMap).slice(0, 50));

const samplers = buildSamplers(csvRows);

// augment cfg axes with axis key for convenience
for (const [mod, mdef] of Object.entries(cfg.modules)) {
  for (const [ax, adef] of Object.entries(mdef.axes)) {
    adef.axis = ax; // store axis label
  }
}

let playing = true;
const btn = document.getElementById('playPause');
const scrub = document.getElementById('scrub');
const tval = document.getElementById('tval');

btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; };

let t0 = performance.now();
let tMs = 0;
function frame(now) {
  const dt = now - t0; t0 = now;
  if (playing) {
    tMs = Math.min(+scrub.max, tMs + dt);
    if (tMs >= +scrub.max) tMs = 0; // loop
    scrub.value = String(tMs|0);
    tval.textContent = scrub.value;
  } else {
    tMs = +scrub.value;
  }

  // reset + apply
  for (const [mod, mdef] of Object.entries(cfg.modules)) {
    const node = nameMap[mdef.nodeName];
    if (!node) continue;
    resetLocal(node);
    for (const [ax, adef] of Object.entries(mdef.axes)) {
      const key = `${mod}:${ax}`;
      const sampler = samplers.get(key);
      if (!sampler) continue;
      let val = sampler(tMs) * (adef.scale ?? 1);
      applyTransform(node, adef, val);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame((n)=>{ t0=n; frame(n); });

window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
