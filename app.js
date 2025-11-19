import * as THREE from 'three';
import { initScene } from './scene/initScene.js';
import { loadModel } from './scene/modelLoader.js';
import { initCameraPresets } from './cameraPresets.js';
import { initMotionPlayer } from './motionPlayer.js';
import { initModelPrompt } from './ui/modelPrompt.js';
import { initMotionPrompt } from './ui/motionPrompt.js';
import { initComponentSidebar } from './ui/componentSidebar.js';
import { loadRigConfig } from './config/loadRigConfig.js';

const rigConfigPromise = loadRigConfig();

const { scene, camera, renderer, controls, clock, setEvenLighting, getEvenLighting } = initScene();
const componentSidebar = initComponentSidebar({
  scene,
  onEvenLightingChange: setEvenLighting,
  initialEvenLighting: getEvenLighting(),
});
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
    const rigConfig = await rigConfigPromise;
    const gltf = await loadModel({ url: sourceUrl });
    const model = gltf.scene;
    activeModel = model;
    scene.add(model);
    console.log('[BASE] GLB loaded:', model);

    applyModuleStyling(model, rigConfig);
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

function applyModuleStyling(model, rigConfig) {
  const modules = rigConfig?.modules;
  if (!modules) return;

  const fallbackPalette = [
    '#ff5555', '#55aaff', '#55ff55', '#ffd966', '#f27d42', '#c678ff', '#7df5d1',
  ];
  let fallbackIndex = 0;

  for (const [moduleName, moduleInfo] of Object.entries(modules)) {
    const nodeName = moduleInfo.nodeName;
    if (!nodeName) continue;
    const targets = [];
    model.traverse((obj) => {
      if (obj.isMesh && obj.name === nodeName) {
        targets.push(obj);
      }
    });
    if (!targets.length) continue;

    const colorValue = moduleInfo.color || fallbackPalette[fallbackIndex++ % fallbackPalette.length];
    let colorHex = 0xffffff;
    try {
      colorHex = new THREE.Color(colorValue).getHex();
    } catch (err) {
      console.warn(`[BASE] Invalid color for ${moduleName}:`, colorValue, err);
    }

    targets.forEach((obj) => {
      obj.material = obj.material.clone();
      obj.material.color.setHex(colorHex);
      obj.material.needsUpdate = true;
      obj.material.emissive.setHex(0x222222);
    });
  }
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
