// --- Base viewer: scene + camera + lights + grid + GLB load (no motion) ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { initCameraPresets } from './cameraPresets.js';
import { initMotionPlayer } from './motionPlayer.js';   // 👈 add this

let motion = null; 

let scene, camera, renderer, controls, clock;

init();
loadModel();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(3, 2, 6);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  const cams = initCameraPresets({ camera, controls });

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 3);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 6);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Helpers (optional)
  const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
  grid.position.y = 0;
  scene.add(grid);

  const axes = new THREE.AxesHelper(1.0);
  axes.position.set(0, 0.01, 0);
  scene.add(axes);

  // Timing
  clock = new THREE.Clock();

  // Resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create a pivot parent at a world-space point and keep the child's world transform intact
function addPivotAt(target, worldPivot) {
  const parent = target.parent;
  if (!parent) return target;

  const pivot = new THREE.Object3D();
  pivot.name = `${target.name}_PIVOT`;

  // put pivot under the same parent, positioned at the desired world pivot
  parent.add(pivot);
  // convert world -> parent's local
  const localPivot = parent.worldToLocal(worldPivot.clone());
  pivot.position.copy(localPivot);

  // Reparent while preserving world transform
  pivot.attach(target);

  return pivot;
}

// Common pivot positions derived from the object's bounds
function makePivot(target, mode = 'center') {
  // compute world-space bounding box
  const box = new THREE.Box3().setFromObject(target);
  const worldCenter = box.getCenter(new THREE.Vector3());
  let worldPivot = worldCenter;

  if (mode === 'bottom') {
    worldPivot = new THREE.Vector3(worldCenter.x, box.min.y, worldCenter.z);
  } else if (mode.x !== undefined) {
    // mode can be a THREE.Vector3 world position
    worldPivot = mode;
  }

  return addPivotAt(target, worldPivot);
}

// ---- GLB loader (plain; no motion wiring yet) ----
function loadModel() {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  // Draco requirements -------------------------------
  dracoLoader.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/');
  dracoLoader.setDecoderConfig({ type: 'wasm' }); // prefer WASM
  loader.setDRACOLoader(dracoLoader);
  // ---------------------------------------------------
  loader.load(
    './assets/model.glb',                // adjust path/name
    (gltf) => {
      const model = gltf.scene;
      // Optional: do NOT recenter if you fixed bounding box/origin alignment already
      // const box = new THREE.Box3().setFromObject(model);
      // const center = box.getCenter(new THREE.Vector3());
      // model.position.sub(center);

      scene.add(model);
      console.log('[BASE] GLB loaded:', model);

      const moduleColors = {
        Body1001: 0xff5555,  // red
        Body1002: 0x55aaff,  // blue
        Body1003: 0x55ff55,  // green
      };

      model.traverse((obj) => {
        if (!obj.isMesh) return;
        const baseName = Object.keys(moduleColors).find(name => obj.name.includes(name));
        if (baseName) {
          // clone the material so each module has independent color control
          obj.material = obj.material.clone();
          obj.material.color.setHex(moduleColors[baseName]);
          obj.material.needsUpdate = true;
          obj.material.emissive.setHex(0x222222);
        }
      });

      // (optional) see what names are available to target in CSV
      model.traverse(o => { if (o.name) console.log('[NODE]', o.name); });

      // Example: wrap a couple of modules with pivots at their geometric center (or 'bottom')
      const moduleA = model.getObjectByName('Module_A');
      const moduleB = model.getObjectByName('Module_B');
      const moduleC = model.getObjectByName('Module_C');

      // const pivotA = moduleA ? makePivot(moduleA, 'base') : null;
      // const pivotB = moduleB ? makePivot(moduleB, '')  : null;
      const pivotC = moduleC ? makePivot(moduleC, 'center') : null;

      // console.log('Pivot A:', pivotA?.name, 'Pivot B:', pivotB?.name, 'Pivot C:', pivotC?.name);

      motion = initMotionPlayer({ model, clock, controls });
      motion.attachFileInput('#csvFile'); // hook the input
    },
    (xhr) => {
      if (xhr.total) {
        const pct = (xhr.loaded / xhr.total) * 100;
        if (Number.isFinite(pct)) console.log(`[BASE] Loading ${pct.toFixed(0)}%`);
      }
    },
    (err) => {
      console.error('[BASE] GLB load error:', err);
    }
  );
}

// ---- Render loop (no motion.update here) ----
function animate() {
  requestAnimationFrame(animate);
  if (motion) motion.update();
  controls.update();
  renderer.render(scene, camera);
}
