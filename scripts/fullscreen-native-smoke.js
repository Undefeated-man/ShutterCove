/* Synthetic demo photographs, real preload IPC and actual Electron window.
 * No library files, settings, or any other application's window are modified. */
(async () => {
  const checks = [], events = [];
  const assert = (condition, label, details) => { if (!condition) throw new Error(label + (details ? ` ${JSON.stringify(details)}` : '')); checks.push(label); };
  const wait = async condition => {
    for (let attempt = 0; attempt < 600; attempt++) {
      if (await condition()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Native fullscreen timeout: ${condition.toString()}`);
  };
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await wait(() => window.App?.api.isDemo && window.PhotoViewer && App.state.photos.length && !App.state.scanning);
  const bridge = window.timeMachine, api = App.api;
  const saved = Object.fromEntries(['getPhotoFullscreen', 'setPhotoFullscreen', 'onPhotoFullscreen'].map(name => [name, api[name]]));
  let initial = null, remove;
  const key = value => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const detail = () => document.querySelector('.photo-detail');
  const full = () => detail()?.dataset.photoFullscreen === 'true';
  const photo = App.state.filtered.find(item => item.jpegPath && item.rawPath);
  try {
    assert(api.isDemo && photo, 'Real-window fullscreen uses synthetic paired demo photographs');
    assert(typeof bridge.getPhotoFullscreen === 'function' && typeof bridge.setPhotoFullscreen === 'function' && typeof bridge.onPhotoFullscreen === 'function', 'Actual context-isolated native fullscreen bridge is available');
    initial = await bridge.getPhotoFullscreen();
    assert(typeof initial.enabled === 'boolean', 'Native window reports its original fullscreen state');
    for (const name of Object.keys(saved)) api[name] = bridge[name];
    remove = bridge.onPhotoFullscreen(state => events.push(state.enabled));
    document.querySelector(`.photo-card[data-id="${photo.id}"]`).click();
    await wait(() => App.state.inspectorId === photo.id && document.getElementById('preview-jpeg')?.naturalWidth > 0 && document.getElementById('preview-raw')?.naturalWidth > 0);
    document.querySelector('[data-viewer-fullscreen="jpeg"]').click();
    await wait(async () => full() && (await bridge.getPhotoFullscreen()).enabled && !document.querySelector('[data-viewer-fullscreen="jpeg"]').disabled);
    await frames();
    assert((await bridge.getPhotoFullscreen()).enabled === true, 'Visible photo fullscreen button actually places the Electron window in system fullscreen');
    if (!initial.enabled) assert(events.includes(true), 'Native enter-full-screen event is delivered to the context-isolated renderer');
    const frame = document.querySelector('.is-fullscreen-active .preview-frame'), r = frame.getBoundingClientRect();
    frame.dispatchEvent(new WheelEvent('wheel', { altKey: true, deltaY: -200, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    assert(Number(frame.dataset.zoom) > 1.6, 'Actual system fullscreen retains Alt or Option detail zoom');
    document.querySelector('[data-fullscreen-format="raw"]').click(); await frames();
    assert(document.querySelector('.is-fullscreen-active .preview-frame').dataset.viewerFormat === 'raw', 'Actual native fullscreen can switch from JPEG to CR3 preview');
    key('Escape');
    await wait(async () => !full() && (await bridge.getPhotoFullscreen()).enabled === initial.enabled);
    assert(App.state.inspectorId === photo.id && detail(), 'Native fullscreen Esc restores ordinary detail without closing its photograph');
    if (!initial.enabled) {
      await wait(() => events.includes(false));
      assert(events.includes(false), 'Native leave-full-screen event is delivered on restoration');
    }
    key('f');
    await wait(async () => full() && (await bridge.getPhotoFullscreen()).enabled && !document.querySelector('[data-viewer-fullscreen="raw"]').disabled);
    App.closeModal();
    await wait(async () => (await bridge.getPhotoFullscreen()).enabled === initial.enabled);
    assert(!detail(), 'Closing the native fullscreen photo restores the original native window state');
    let rejected = false;
    try { await bridge.setPhotoFullscreen({ enabled: 'yes' }); } catch (_) { rejected = true; }
    assert(rejected && (await bridge.getPhotoFullscreen()).enabled === initial.enabled, 'Native bridge rejects nonboolean fullscreen requests without changing the window');
  } finally {
    App.closeModal();
    if (initial) await bridge.setPhotoFullscreen(initial);
    remove?.();
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete api[name]; else api[name] = value; }
    document.getElementById('toast-root').replaceChildren();
  }
  return { passed: checks.length, checks, nativeEvents: events, viewport: { width: innerWidth, height: innerHeight } };
})();
