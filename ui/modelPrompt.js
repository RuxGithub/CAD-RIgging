export function initModelPrompt({ onModelURL, fallbackUrl }) {
  const modal = document.getElementById('modelPrompt');
  const fileInput = document.getElementById('modelFile');
  const loadButton = document.getElementById('modelLoadButton');

  if (!modal || !fileInput || !loadButton) {
    console.warn('[BASE] Model picker UI missing; attempting to load fallback GLB.');
    if (fallbackUrl && onModelURL) {
      Promise.resolve(onModelURL(fallbackUrl)).catch((err) => {
        console.error('[BASE] Failed to load fallback model:', err);
      });
    }
    return { hide() {}, show() {} };
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

  loadButton.addEventListener('click', async () => {
    if (!hasSelection() || isLoading) return;
    const file = fileInput.files[0];
    const objectUrl = URL.createObjectURL(file);
    isLoading = true;
    updateButtonState();
    try {
      await onModelURL?.(objectUrl);
      modal.classList.add('hidden');
      fileInput.value = '';
    } catch (err) {
      console.error('[BASE] Failed to load model:', err);
      alert('Unable to load that GLB/GLTF file. Please verify the file and try again.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      isLoading = false;
      updateButtonState();
    }
  });

  updateButtonState();

  return {
    hide: () => modal.classList.add('hidden'),
    show: () => modal.classList.remove('hidden'),
  };
}
