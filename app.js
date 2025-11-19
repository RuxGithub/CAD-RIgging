import * as THREE from 'three';
import { initScene } from './scene/initScene.js';
import { loadModel } from './scene/modelLoader.js';
import { initCameraPresets } from './cameraPresets.js';
import { initMotionPlayer } from './motionPlayer.js';
import { initModelPrompt } from './ui/modelPrompt.js';
import { initMotionPrompt } from './ui/motionPrompt.js';
import { initComponentSidebar } from './ui/componentSidebar.js';

const { scene, camera, renderer, controls, clock } = initScene();
const componentSidebar = initComponentSidebar({ scene });
const cameraController = initCameraPresets({
  camera,
  controls,
  onPresetChange: (name) => componentSidebar.syncCameraPreset?.(name),
});
componentSidebar.attachCameraController(cameraController);

const motionLoaderUI = initMotionPrompt();
initModelPrompt({
  onModelURL: handleModelLoad,
  fallbackUrl: './assets/model.glb',
});

let motion = null;
let activeModel = null;

animate();

async function handleModelLoad(sourceUrl) {
  if (!sourceUrl) return;

  motionLoaderUI.disableTrigger?.();
  componentSidebar.reset?.();
  if (activeModel) {
    scene.remove(activeModel);
    activeModel = null;
  }

  try {
    const gltf = await loadModel({ url: sourceUrl });
    const model = gltf.scene;
    activeModel = model;
    scene.add(model);
    console.log('[BASE] GLB loaded:', model);

    applyModuleStyling(model);
    setupReferencePivots(model);

    motion = initMotionPlayer({ model, clock, controls });
    motionLoaderUI.setOnLoad?.((csvText) => motion.loadCSVText(csvText));
    motionLoaderUI.enableTrigger?.();
    componentSidebar.populate?.(model);
    componentSidebar.setCollapsed?.(false);
    componentSidebar.bindMotionControls?.(motion);
    componentSidebar.syncCameraPreset?.(cameraController.getPreset?.());
    motionLoaderUI.show?.();
  } catch (err) {
    console.error('[BASE] GLB load error:', err);
    motionLoaderUI.enableTrigger?.();
    throw err;
  }
}

function applyModuleStyling(model) {
  const moduleColors = {
    Body1001: 0xff5555,
    Body1002: 0x55aaff,
    Body1003: 0x55ff55,
  };

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const baseName = Object.keys(moduleColors).find((name) => obj.name.includes(name));
    if (baseName) {
      obj.material = obj.material.clone();
      obj.material.color.setHex(moduleColors[baseName]);
      obj.material.needsUpdate = true;
      obj.material.emissive.setHex(0x222222);
    }
  });
}

function setupReferencePivots(model) {
  const moduleC = model.getObjectByName('Module_C');
  if (moduleC) makePivot(moduleC, 'center');
}

function animate() {
  requestAnimationFrame(animate);
  motion?.update?.();
  componentSidebar.updateHighlights?.();
  controls.update();
  renderer.render(scene, camera);
}

function addPivotAt(target, worldPivot) {
  const parent = target.parent;
  if (!parent) return target;

  const pivot = new THREE.Object3D();
  pivot.name = `${target.name}_PIVOT`;
  parent.add(pivot);
  const localPivot = parent.worldToLocal(worldPivot.clone());
  pivot.position.copy(localPivot);
  pivot.attach(target);
  return pivot;
}

function makePivot(target, mode = 'center') {
  const box = new THREE.Box3().setFromObject(target);
  const worldCenter = box.getCenter(new THREE.Vector3());
  let worldPivot = worldCenter;

  if (mode === 'bottom') {
    worldPivot = new THREE.Vector3(worldCenter.x, box.min.y, worldCenter.z);
  } else if (mode.x !== undefined) {
    worldPivot = mode;
  }

  return addPivotAt(target, worldPivot);
}

