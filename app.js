// --- Base viewer: scene + camera + lights + grid + GLB load (no motion) ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { initCameraPresets } from './cameraPresets.js';
import { initMotionPlayer } from './motionPlayer.js';   // 👈 add this

let motion = null; 
let motionLoaderUI = null;
let modelOverviewUI = null;
let highlightBoxes = [];
let cameraController = null;

let scene, camera, renderer, controls, clock;

init();
motionLoaderUI = initMotionPrompt();
modelOverviewUI = initModelOverview();
modelOverviewUI?.attachCameraController?.(cameraController);
initModelPrompt();
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

  cameraController = initCameraPresets({
    camera,
    controls,
    onPresetChange: (name) => modelOverviewUI?.syncCameraPreset?.(name),
  });

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

function initModelPrompt() {
  const modal = document.getElementById('modelPrompt');
  const fileInput = document.getElementById('modelFile');
  const loadButton = document.getElementById('modelLoadButton');

  if (!modal || !fileInput || !loadButton) {
    console.warn('[BASE] Model picker UI missing; loading bundled GLB.');
    loadModel('./assets/model.glb');
    return;
  }

  let isLoading = false;
  const hasSelection = () => Boolean(fileInput.files && fileInput.files.length);
  const updateButtonState = () => {
    if (isLoading) {
      loadButton.textContent = 'Loading...';
      loadButton.disabled = true;
    } else {
      loadButton.textContent = 'Load Model';
      loadButton.disabled = !hasSelection();
    }
  };

  fileInput.addEventListener('change', () => {
    if (!isLoading) updateButtonState();
  });

  loadButton.addEventListener('click', () => {
    if (!hasSelection() || isLoading) return;
    isLoading = true;
    updateButtonState();
    const file = fileInput.files[0];
    const objectUrl = URL.createObjectURL(file);
    loadModel(objectUrl, {
      onSuccess: () => {
        modal.classList.add('hidden');
        fileInput.value = '';
      },
      onError: () => {
        alert('Unable to load that GLB/GLTF file. Please verify the file and try again.');
      },
      onFinally: () => {
        URL.revokeObjectURL(objectUrl);
        isLoading = false;
        updateButtonState();
      },
    });
  });

  updateButtonState();
}

function initMotionPrompt() {
  const overlay = document.getElementById('motionPrompt');
  const fileInput = document.getElementById('motionFile');
  const loadButton = document.getElementById('motionLoadButton');
  const cancelButton = document.getElementById('motionCancelButton');
  const triggerButton = document.getElementById('openMotionLoader');

  if (!overlay || !fileInput || !loadButton || !triggerButton) {
    console.warn('[BASE] Motion picker UI missing; CSV reload disabled.');
    return {
      show() {},
      enableTrigger() {},
      disableTrigger() {},
      setOnLoad() {},
    };
  }

  let onLoadHandler = null;
  let isReady = false;
  let isLoading = false;

  const hasSelection = () => Boolean(fileInput.files && fileInput.files.length);
  const updateLoadButton = () => {
    if (isLoading) {
      loadButton.textContent = 'Loading...';
      loadButton.disabled = true;
    } else {
      loadButton.textContent = 'Load Motion';
      loadButton.disabled = !hasSelection();
    }
  };
  const closeOverlay = () => {
    overlay.classList.add('hidden');
    fileInput.value = '';
    isLoading = false;
    updateLoadButton();
  };
  const openOverlay = () => {
    if (!isReady) return;
    overlay.classList.remove('hidden');
  };

  triggerButton.addEventListener('click', openOverlay);
  cancelButton?.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay();
  });
  fileInput.addEventListener('change', () => {
    if (!isLoading) updateLoadButton();
  });

  loadButton.addEventListener('click', () => {
    if (!hasSelection() || isLoading || !onLoadHandler) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    isLoading = true;
    updateLoadButton();
    reader.onload = () => {
      isLoading = false;
      updateLoadButton();
      closeOverlay();
      onLoadHandler(String(reader.result));
    };
    reader.onerror = () => {
      isLoading = false;
      updateLoadButton();
      alert('Unable to read that CSV file. Please try again.');
    };
    reader.readAsText(file);
  });

  triggerButton.disabled = true;
  closeOverlay();

  return {
    show: () => openOverlay(),
    enableTrigger: () => {
      isReady = true;
      triggerButton.disabled = false;
    },
    disableTrigger: () => {
      isReady = false;
      triggerButton.disabled = true;
      closeOverlay();
    },
    setOnLoad: (handler) => {
      onLoadHandler = handler;
    },
  };
}

function initModelOverview() {
  const container = document.getElementById('componentSidebar');
  const toggleBtn = document.getElementById('componentSidebarToggle');
  const listEl = document.getElementById('modelComponentList');
  const summaryEl = document.getElementById('modelComponentSummary');
  const tabButtons = container?.querySelectorAll('.sidebar-tab') ?? [];
  const panels = container?.querySelectorAll('.sidebar-panel') ?? [];

  const cameraPresetSelect = document.getElementById('cameraPresetSelect');
  const cameraDurationInput = document.getElementById('cameraDurationInput');
  const cameraDurationValue = document.getElementById('cameraDurationValue');
  const cameraQuickButtons = document.getElementById('cameraQuickButtons');

  const motionPlayButton = document.getElementById('motionPlayButton');
  const motionPauseButton = document.getElementById('motionPauseButton');
  const motionStopButton = document.getElementById('motionStopButton');
  const motionProgress = document.getElementById('motionProgress');
  const motionProgressValue = document.getElementById('motionProgressValue');
  const motionSpeed = document.getElementById('motionSpeed');
  const motionSpeedValue = document.getElementById('motionSpeedValue');
  const motionLoopToggle = document.getElementById('motionLoopToggle');
  const motionStatusText = document.getElementById('motionStatusText');

  if (!container || !toggleBtn || !listEl || !summaryEl) {
    console.warn('[BASE] Component sidebar UI missing; component lookup disabled.');
    return {
      populate() {},
      reset() {},
      setCollapsed() {},
      attachCameraController() {},
      bindMotionControls() {},
    };
  }

  let activeButton = null;
  let isReady = false;
  let cameraCtrl = null;
  let motionCtrl = null;

  const isCollapsed = () => container.classList.contains('collapsed');
  const setCollapsed = (collapsed) => {
    container.classList.toggle('collapsed', collapsed);
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  };
  const setDisabled = (disabled) => {
    container.classList.toggle('disabled', disabled);
    toggleBtn.disabled = disabled;
  };

  const renderEmpty = (message) => {
    listEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'overview-empty';
    empty.textContent = message;
    listEl.appendChild(empty);
  };

  const reset = () => {
    isReady = false;
    activeButton = null;
    summaryEl.textContent = 'Load a model to inspect components';
    renderEmpty('Load a model to list all named meshes here.');
    clearHighlightHelpers();
    setDisabled(true);
    setCollapsed(true);
    setActiveTab('components');
    motionCtrl?.setStateListener?.(null);
    motionCtrl = null;
    setMotionControlsDisabled(true);
  };

  const setActiveTab = (tabName) => {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tabName));
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  toggleBtn.addEventListener('click', () => {
    if (!isReady) return;
    setCollapsed(!isCollapsed());
  });

  function populate(model) {
    activeButton = null;
    listEl.innerHTML = '';
    clearHighlightHelpers();

    const nameMap = new Map();
    model.traverse((obj) => {
      if (!obj.isMesh || !obj.name) return;
      if (!nameMap.has(obj.name)) nameMap.set(obj.name, []);
      nameMap.get(obj.name).push(obj);
    });

    const entries = Array.from(nameMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    summaryEl.textContent = entries.length
      ? `${entries.length} components detected`
      : 'No components detected';

    if (!entries.length) {
      renderEmpty('No mesh nodes with names were found in this model.');
    } else {
      for (const [name, nodes] of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'overview-item';
        button.textContent = name;
        button.addEventListener('click', () => {
          highlightComponents(nodes);
          if (activeButton) activeButton.classList.remove('active');
          button.classList.add('active');
          activeButton = button;
        });
        listEl.appendChild(button);
      }
    }

    isReady = true;
    setDisabled(false);
  }

  function syncCameraPreset(name) {
    if (!name || !cameraPresetSelect) return;
    cameraPresetSelect.value = name;
    if (cameraQuickButtons) {
      cameraQuickButtons.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.preset === name);
      });
    }
  }

  function attachCameraController(controller) {
    cameraCtrl = controller;
    if (!cameraPresetSelect || !cameraCtrl) return;
    const presetNames = Object.keys(cameraCtrl.presets ?? {});
    cameraPresetSelect.innerHTML = '';
    presetNames.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      cameraPresetSelect.appendChild(option);
    });
    cameraPresetSelect.value = cameraCtrl.getPreset?.() ?? presetNames[0];
    if (cameraDurationInput && cameraDurationValue) {
      const duration = cameraCtrl.getDuration?.() ?? 500;
      cameraDurationInput.value = duration;
      cameraDurationValue.textContent = `${Math.round(duration)} ms`;
    }
    if (cameraQuickButtons) {
      cameraQuickButtons.innerHTML = '';
      presetNames.slice(0, 3).forEach((name) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip-button';
        btn.textContent = name;
        btn.dataset.preset = name;
        btn.addEventListener('click', () => {
          cameraCtrl.set?.(name);
          syncCameraPreset(name);
        });
        cameraQuickButtons.appendChild(btn);
      });
    }
    syncCameraPreset(cameraCtrl.getPreset?.() ?? presetNames[0]);
  }

  cameraPresetSelect?.addEventListener('change', (e) => {
    cameraCtrl?.set?.(e.target.value);
    syncCameraPreset(e.target.value);
  });

  cameraDurationInput?.addEventListener('input', (e) => {
    if (!cameraCtrl) return;
    const result = cameraCtrl.setDuration?.(Number(e.target.value));
    if (result != null && cameraDurationValue) {
      cameraDurationValue.textContent = `${Math.round(result)} ms`;
    }
  });

  function bindMotionControls(controller) {
    motionCtrl?.setStateListener?.(null);
    motionCtrl = controller;
    motionCtrl?.setStateListener?.(handleMotionState);
    const enabled = Boolean(controller);
    setMotionControlsDisabled(!enabled);
  }

  function setMotionControlsDisabled(disabled) {
    [motionPlayButton, motionPauseButton, motionStopButton, motionProgress, motionSpeed, motionLoopToggle]
      .forEach((el) => { if (el) el.disabled = disabled; });
    if (motionStatusText && disabled) {
      motionStatusText.textContent = 'No motion file loaded.';
    }
  }

  function handleMotionState(state) {
    if (!state) return;
    const { playing, loop, speed, progress, timeMs, durationMs } = state;
    if (motionPlayButton) motionPlayButton.disabled = false;
    if (motionPauseButton) motionPauseButton.disabled = !playing;
    if (motionProgress) motionProgress.value = String(progress ?? 0);
    if (motionSpeed) motionSpeed.value = String(speed ?? 1);
    if (motionLoopToggle) motionLoopToggle.checked = loop ?? true;
    if (motionProgressValue) {
      const pct = ((progress ?? 0) * 100).toFixed(1);
      motionProgressValue.textContent = `${pct}%`;
    }
    if (motionSpeedValue) motionSpeedValue.textContent = `${(speed ?? 1).toFixed(1)}x`;
    if (motionStatusText) {
      const secs = ((timeMs ?? 0) / 1000).toFixed(2);
      const total = ((durationMs ?? 0) / 1000).toFixed(2);
      motionStatusText.textContent = playing
        ? `Playing... ${secs}s / ${total}s`
        : `Idle at ${secs}s / ${total}s`;
    }
  }

  motionPlayButton?.addEventListener('click', () => motionCtrl?.play?.());
  motionPauseButton?.addEventListener('click', () => motionCtrl?.pause?.());
  motionStopButton?.addEventListener('click', () => motionCtrl?.stop?.());
  motionProgress?.addEventListener('input', (e) => motionCtrl?.setProgress?.(Number(e.target.value)));
  motionSpeed?.addEventListener('input', (e) => {
    motionCtrl?.setSpeed?.(Number(e.target.value));
    if (motionSpeedValue) motionSpeedValue.textContent = `${Number(e.target.value).toFixed(1)}x`;
  });
  motionLoopToggle?.addEventListener('change', (e) => motionCtrl?.setLoop?.(e.target.checked));

  reset();

  return { populate, reset, setCollapsed, attachCameraController, bindMotionControls, syncCameraPreset };
}

function clearHighlightHelpers() {
  for (const { helper } of highlightBoxes) {
    scene.remove(helper);
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  }
  highlightBoxes = [];
}

function highlightComponents(objects) {
  if (!Array.isArray(objects) || !objects.length) return;
  clearHighlightHelpers();
  highlightBoxes = objects.map((object) => {
    const helper = new THREE.BoxHelper(object, 0x76a5ff);
    scene.add(helper);
    return { helper, object };
  });
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
function loadModel(sourceUrl, { onSuccess, onError, onFinally } = {}) {
  if (!sourceUrl) {
    console.warn('[BASE] No GLB source specified for loadModel().');
    return;
  }

  motionLoaderUI?.disableTrigger?.();
  modelOverviewUI?.reset?.();
  clearHighlightHelpers();

  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  // Draco requirements -------------------------------
  dracoLoader.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/');
  dracoLoader.setDecoderConfig({ type: 'wasm' }); // prefer WASM
  loader.setDRACOLoader(dracoLoader);
  // ---------------------------------------------------
  loader.load(
    sourceUrl,
    (gltf) => {
      const model = gltf.scene;
      // Optional: do NOT recenter if you fixed bounding box/origin alignment already
      // const box = new THREE.Box3().setFromObject(model);
      // const center = box.getCenter(new THREE.Vector3());
      // model.position.sub(center);

      scene.add(model);
      console.log('[BASE] GLB loaded:', model);

      // (optional) see what names are available to target in CSV
      model.traverse(o => { if (o.name) console.log('[NODE]', o.name); });

      // Example: wrap a couple of modules with pivots at their geometric center (or 'bottom')
      const moduleC = model.getObjectByName('Module_C');

      // const pivotA = moduleA ? makePivot(moduleA, 'base') : null;
      // const pivotB = moduleB ? makePivot(moduleB, '')  : null;
      const pivotC = moduleC ? makePivot(moduleC, 'center') : null;

      // console.log('Pivot A:', pivotA?.name, 'Pivot B:', pivotB?.name, 'Pivot C:', pivotC?.name);

      motion = initMotionPlayer({ model, clock, controls });
      motionLoaderUI?.setOnLoad?.((csvText) => motion.loadCSVText(csvText));
      motionLoaderUI?.enableTrigger?.();
      modelOverviewUI?.populate?.(model);
      modelOverviewUI?.setCollapsed?.(false);
      modelOverviewUI?.bindMotionControls?.(motion);
      motionLoaderUI?.show?.();

      onSuccess?.(gltf);
      onFinally?.();
    },
    (xhr) => {
      if (xhr.total) {
        const pct = (xhr.loaded / xhr.total) * 100;
        if (Number.isFinite(pct)) console.log(`[BASE] Loading ${pct.toFixed(0)}%`);
      }
    },
    (err) => {
      console.error('[BASE] GLB load error:', err);
      if (motion) {
        motionLoaderUI?.setOnLoad?.((csvText) => motion.loadCSVText(csvText));
        motionLoaderUI?.enableTrigger?.();
      }
      onError?.(err);
      onFinally?.();
    }
  );
}

// ---- Render loop (no motion.update here) ----
function animate() {
  requestAnimationFrame(animate);
  if (motion) motion.update();
  if (highlightBoxes.length) {
    for (const { helper, object } of highlightBoxes) {
      helper.update(object);
    }
  }
  controls.update();
  renderer.render(scene, camera);
}
