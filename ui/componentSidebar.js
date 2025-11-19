import * as THREE from 'three';

export function initComponentSidebar({ scene, onEvenLightingChange, initialEvenLighting = false }) {
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
  const evenLightingToggle = document.getElementById('evenLightingToggle');

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
      syncCameraPreset() {},
    };
  }

  let activeButton = null;
  let isReady = false;
  let cameraCtrl = null;
  let motionCtrl = null;
  let highlightBoxes = [];

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

  const clearHighlightHelpers = () => {
    for (const { helper } of highlightBoxes) {
      scene.remove(helper);
      helper.geometry?.dispose?.();
      helper.material?.dispose?.();
    }
    highlightBoxes = [];
  };

  const updateHighlights = () => {
    highlightBoxes.forEach(({ helper, object }) => helper.update(object));
  };

  const highlightComponents = (objects) => {
    if (!Array.isArray(objects) || !objects.length) return;
    clearHighlightHelpers();
    highlightBoxes = objects.map((object) => {
      const helper = new THREE.BoxHelper(object, 0x76a5ff);
      scene.add(helper);
      return { helper, object };
    });
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
        btn.dataset.preset = name;
        btn.textContent = name;
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

  if (evenLightingToggle) {
    evenLightingToggle.checked = initialEvenLighting;
    evenLightingToggle.addEventListener('change', (e) => {
      onEvenLightingChange?.(e.target.checked);
    });
  }

  reset();

  const setEvenLightingToggle = (value) => {
    if (evenLightingToggle) evenLightingToggle.checked = Boolean(value);
  };

  return {
    populate,
    reset,
    setCollapsed,
    attachCameraController,
    bindMotionControls,
    syncCameraPreset,
    clearHighlightHelpers,
    updateHighlights,
    setEvenLightingToggle,
  };
}
