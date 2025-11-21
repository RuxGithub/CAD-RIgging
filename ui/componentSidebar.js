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

    const entries = gatherNamedEntries(model);
    summaryEl.textContent = entries.length
      ? `${entries.length} components detected`
      : 'No components detected';

    if (!entries.length) {
      renderEmpty('No named nodes were found in this model.');
    } else {
      renderEntries(entries);
    }

    isReady = true;
    setDisabled(false);
  }

  function gatherNamedEntries(root) {
    const entries = [];
    function walk(object, depth, parentId = null) {
      let currentDepth = depth;
      let nodeId = parentId;
      if (object.name) {
        nodeId = `${object.uuid}`;
        const entry = { id: nodeId, name: object.name, object, depth, parentId, children: [] };
        entries.push(entry);
        if (parentId) {
          const parentEntry = entries.find((e) => e.id === parentId);
          parentEntry?.children.push(nodeId);
        }
        currentDepth = depth + 1;
      }
      object.children.forEach((child) => walk(child, currentDepth, nodeId));
    }
    root.children.forEach((child) => walk(child, 0));
    return entries;
  }

  function renderEntries(entries) {
    const collapsed = new Set();
    const entryElements = new Map();
    const idToEntry = new Map(entries.map((entry) => [entry.id, entry]));

    const buildButton = (entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'overview-item';
      button.dataset.entryId = entry.id;

      const content = document.createElement('div');
      content.className = 'overview-item-content';

      if (entry.children?.length) {
        const caret = document.createElement('button');
        caret.type = 'button';
        caret.className = 'overview-caret';
        caret.textContent = '▾';
        caret.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleCollapse(entry.id, caret);
        });
        content.appendChild(caret);
      } else {
        const spacer = document.createElement('span');
        spacer.style.width = '1rem';
        spacer.ariaHidden = 'true';
        content.appendChild(spacer);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'overview-name';
      nameSpan.textContent = entry.name;
      content.appendChild(nameSpan);

      button.style.paddingLeft = `${0.75 + entry.depth * 0.85}rem`;
      button.appendChild(content);

      button.addEventListener('click', () => {
        if (activeButton === button) {
          button.classList.remove('active');
          activeButton = null;
          clearHighlightHelpers();
          return;
        }
        const nodes = collectMeshes(entry.object);
        highlightComponents(nodes);
        if (activeButton) activeButton.classList.remove('active');
        button.classList.add('active');
        activeButton = button;
      });

      return button;
    };

    const toggleCollapse = (id, caretButton) => {
      if (collapsed.has(id)) {
        collapsed.delete(id);
        caretButton.classList.remove('collapsed');
        updateVisibility(id, false);
      } else {
        collapsed.add(id);
        caretButton.classList.add('collapsed');
        updateVisibility(id, true);
      }
    };

    const updateVisibility = (parentId, hide) => {
      const queue = [...(idToEntry.get(parentId)?.children ?? [])];
      while (queue.length) {
        const childId = queue.shift();
        const el = entryElements.get(childId);
        if (!el) continue;
        el.style.display = hide ? 'none' : '';
        if (collapsed.has(childId)) continue;
        queue.push(...(idToEntry.get(childId)?.children ?? []));
      }
    };

    entries.forEach((entry) => {
      const button = buildButton(entry);
      entryElements.set(entry.id, button);
      if (entry.parentId && collapsed.has(entry.parentId)) {
        button.style.display = 'none';
      }
      listEl.appendChild(button);
    });
  }

  function collectMeshes(object) {
    const nodes = [];
    object.traverse((child) => {
      if (child.isMesh) nodes.push(child);
    });
    return nodes;
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
