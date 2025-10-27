// app.js — minimal GLB viewer (no controls)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';


const root = document.getElementById('app');

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// --- AXES + LABELS
const axisGroup = new THREE.Group();
scene.add(axisGroup);

const axes = new THREE.AxesHelper(1);
axisGroup.add(axes);

// Function to build one axis with arrow + label
function makeAxis(dir, color, labelText) {
  const len = 1; // unit length; we scale the whole group later

  const arrow = new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(0,0,0), len, color, 0.15, 0.08);
  axisGroup.add(arrow);

  const sprite = makeTextSprite(labelText, { color });
  sprite.position.copy(dir.clone().normalize().multiplyScalar(len + 0.15));
  axisGroup.add(sprite);

  return { arrow, sprite, dir: dir.clone().normalize() };
}

// Utility: text as small canvas sprite
function makeTextSprite(text, { color = '#000000' } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 48;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(text, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.15;
  sprite.scale.set(scale, scale * (canvas.height / canvas.width), 1);
  return sprite;
}

// Create X/Y/Z arrows + labels
const axisX = makeAxis(new THREE.Vector3(1, 0, 0), 0xff0000, 'X');
const axisY = makeAxis(new THREE.Vector3(0, 1, 0), 0x00ff00, 'Y');
const axisZ = makeAxis(new THREE.Vector3(0, 0, 1), 0x0000ff, 'Z');

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
root.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(2, 1.5, 3);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0); // we centered the model at origin earlier

// Background
scene.background = new THREE.Color(0x40949A);

// Renderer: flat, bright, no shadows
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // keep CAD-flat
renderer.toneMappingExposure = 1;         // gentle lift

// Even “photobooth” lights
const ambient = new THREE.AmbientLight(0xffffff, 0);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0);
scene.add(hemi);

// Neutral studio environment for PBR
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

// Load model
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/');
dracoLoader.setDecoderConfig({ type: 'wasm' }); // prefer WASM
loader.setDRACOLoader(dracoLoader);
loader.load(
  './assets/model.glb',
  (gltf) => {
    const model = gltf.scene || gltf.scenes[0];
    scene.add(model);

    // find-first-by-name anywhere under model
    function findByName(root, name) {
      let found = null;
      root.traverse(o => { if (!found && o.name === name) found = o; });
      return found;
    }

    // Prefer the inner (exact) name; fall back to the parent with trailing "1"
    const parts = {
      Base_Frame: findByName(model, 'Base_Frame') || findByName(model, 'Base_Frame1'),
      Module_A:   findByName(model, 'Module_A')   || findByName(model, 'Module_A1'),
      Module_B:   findByName(model, 'Module_B')   || findByName(model, 'Module_B1'),
      Module_C:   findByName(model, 'Module_C')   || findByName(model, 'Module_C1'),
    };

    // expose for console use: window.parts.Module_A, etc.
    window.parts = parts; 

    // quick sanity log
    console.log('Canonical parts:', Object.fromEntries(
      Object.entries(parts).map(([k,v]) => [k, v ? v.name : '(missing)'])
    ));

    // add static Box3Helper so you can see each module’s extents
    function addBounds(obj, color) {
      if (!obj) return;
      const box = new THREE.Box3().setFromObject(obj);
      const helper = new THREE.Box3Helper(box, color);
      scene.add(helper);
      return helper;
    }

    // Colors: A=red, B=green, C=blue, Base=gray
    addBounds(parts.Base_Frame, 0x000);
    addBounds(parts.Module_A,   0xff0000);
    addBounds(parts.Module_B,   0x00aa00);
    addBounds(parts.Module_C,   0x0000ff);
    
    //---------------------GLB Evaluate------------------------------
    // === HIERARCHY NAME AUDIT ===
    // window.model = model; // handy for DevTools inspection

    // Pretty-print the scene graph with names
    // function printTree(obj, depth = 0) {
    //   const pad = '  '.repeat(depth);
    //   const type = obj.type || 'Object3D';
    //   const name = obj.name && obj.name.trim() !== '' ? obj.name : '(unnamed)';
    //   console.log(`${pad}- [${type}] ${name}`);
    //   obj.children.forEach(child => printTree(child, depth + 1));
    // }

    // Collect name stats
    // const nameCounts = new Map();
    // const unnamed = [];

    // model.traverse((o) => {
    //   const n = (o.name || '').trim();
    //   if (!n) unnamed.push(o);
    //   else nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
    // });

    // Output
    // console.log('--- GLB HIERARCHY ---');
    // printTree(model);

    // console.log('--- NAME SUMMARY ---');
    // console.log(`Total objects:`, nameCounts.size + unnamed.length);
    // console.log(`Unique named objects:`, nameCounts.size);
    // console.log(`Unnamed objects:`, unnamed.length, unnamed);

    // const duplicates = [...nameCounts.entries()].filter(([, c]) => c > 1);
    // if (duplicates.length) {
    //   console.warn('Duplicate names detected:', duplicates);
    // } else {
    //   console.log('No duplicate names detected ✅');
    // }
    //---------------------END GLB Evaluate------------------------------

    // Make PBR materials read the environment strongly enough
    model.traverse((o) => {
      if (o.isMesh && o.material && 'envMapIntensity' in o.material) {
        o.material.envMapIntensity = 0.5; // bump if still dark
        o.material.needsUpdate = true;
      }
    });

    // Frame the model nicely
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // center model at origin
    // model.position.sub(center);



    // fit camera to object
    const maxDim = Math.max(size.x, size.y, size.z);

    axes.scale.setScalar(maxDim * 0.5);

    axisGroup.scale.setScalar(maxDim * 0.5);

    const fitOffset = 1.3;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * fitOffset;

    camera.position.set(0, 0, distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
  },
  undefined,
  (err) => {
    console.error('GLB load error:', err);
  }
);

// Resize
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// Render loop
function render() {
  renderer.render(scene, camera);
  controls.update();
  requestAnimationFrame(render);
}
render();
