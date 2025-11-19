export function initMotionPrompt() {
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

