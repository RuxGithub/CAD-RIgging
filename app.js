// app.js — minimal GLB viewer (no controls)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const root = document.getElementById('app');

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

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

// Lights (simple + neutral)
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

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

    // Frame the model nicely
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // center model at origin
    model.position.sub(center);

    // fit camera to object
    const maxDim = Math.max(size.x, size.y, size.z);
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
  requestAnimationFrame(render);
}
render();
