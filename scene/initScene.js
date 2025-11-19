import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(3, 2, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 3);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 6);
  dir.position.set(5, 10, 7);
  scene.add(dir);
  const ambient = new THREE.AmbientLight(0xffffff, 0);
  scene.add(ambient);

  const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
  grid.position.y = 0;
  scene.add(grid);

  const axes = new THREE.AxesHelper(1.0);
  axes.position.set(0, 0.01, 0);
  scene.add(axes);

  const clock = new THREE.Clock();

  let evenLighting = false;
  const applyLightingProfile = () => {
    if (evenLighting) {
      hemi.intensity = 1.2;
      hemi.groundColor.setHex(0x666666);
      dir.intensity = 0.8;
      ambient.intensity = 1.0;
    } else {
      hemi.intensity = 3;
      hemi.groundColor.setHex(0x222233);
      dir.intensity = 6;
      ambient.intensity = 0.2;
    }
  };
  const setEvenLighting = (enabled) => {
    evenLighting = Boolean(enabled);
    applyLightingProfile();
  };
  const getEvenLighting = () => evenLighting;
  applyLightingProfile();

  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onWindowResize);

  return {
    scene,
    camera,
    renderer,
    controls,
    clock,
    setEvenLighting,
    getEvenLighting,
  };
}
