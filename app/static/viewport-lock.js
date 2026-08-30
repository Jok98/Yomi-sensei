(() => {
  const root = document.documentElement;
  const storageKey = "yomi-sensei-base-dpr-v1";
  const commonBaseRatios = [1, 1.25, 1.5, 1.75, 2];
  const highZoomLevels = [5, 4, 3, 2.5];
  const testZoom = (() => {
    if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) return null;
    const value = Number.parseFloat(new URLSearchParams(window.location.search).get('__yomi_zoom_test'));
    return Number.isFinite(value) && value >= 0.5 && value <= 5 ? value : null;
  })();

  function readStoredBaseRatio() {
    try {
      const value = Number.parseFloat(localStorage.getItem(storageKey));
      return Number.isFinite(value) && value >= 0.75 && value <= 2.5 ? value : null;
    } catch {
      return null;
    }
  }

  function storeBaseRatio(value) {
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      // La compensazione funziona anche senza persistenza.
    }
  }

  function inferBaseRatio(currentRatio) {
    const storedRatio = readStoredBaseRatio();
    if (storedRatio) return storedRatio;

    if (currentRatio > 2.5) {
      for (const zoomLevel of highZoomLevels) {
        const candidate = currentRatio / zoomLevel;
        const baseRatio = commonBaseRatios.find(
          (ratio) => Math.abs(candidate - ratio) <= 0.04,
        );
        if (baseRatio) {
          storeBaseRatio(baseRatio);
          return baseRatio;
        }
      }
      storeBaseRatio(1);
      return 1;
    }

    storeBaseRatio(currentRatio);
    return currentRatio;
  }

  const baseRatio = inferBaseRatio(window.devicePixelRatio || 1);

  function applyViewportLock() {
    const currentRatio = window.devicePixelRatio || baseRatio;
    const rawZoom = testZoom ?? currentRatio / baseRatio;
    const pageZoom = Math.min(5, Math.max(0.5, rawZoom));
    const inverseZoom = 1 / pageZoom;

    root.style.setProperty("--page-zoom", pageZoom.toFixed(4));
    root.style.setProperty("--inverse-page-zoom", inverseZoom.toFixed(6));
    root.style.setProperty("--app-viewport-width", `${window.innerWidth * pageZoom}px`);
    root.style.setProperty("--app-viewport-height", `${window.innerHeight * pageZoom}px`);
    root.style.setProperty("--app-78vh", `${window.innerHeight * pageZoom * 0.78}px`);
    root.dataset.viewportLocked = pageZoom > 1.01 || pageZoom < 0.99 ? "true" : "false";
  }

  let frame = 0;
  function scheduleViewportLock() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyViewportLock);
  }

  applyViewportLock();
  window.addEventListener("resize", scheduleViewportLock, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleViewportLock, { passive: true });
})();
