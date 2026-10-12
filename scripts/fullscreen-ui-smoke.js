/* Exercise the actual fullscreen viewer with synthetic originals and a native
 * bridge simulator. System fullscreen transitions are tested independently by
 * the main process; no real photo library or other native window is touched. */
(async () => {
  const checks = [];
  const assert = (condition, label, details) => { if (!condition) throw new Error(label + (details ? ` ${JSON.stringify(details)}` : '')); checks.push(label); };
  const el = id => document.getElementById(id);
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = async condition => {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`Fullscreen UI timeout: ${condition.toString()}; inspector=${window.App?.state.inspectorId}`);
  };
  await wait(() => window.App?.api.isDemo && window.PhotoViewer && App.state.photos.length && !App.state.scanning);
  const api = App.api;
  const saved = Object.fromEntries(['scan', 'source', 'getPhotoFullscreen', 'setPhotoFullscreen', 'onPhotoFullscreen'].map(key => [key, api[key]]));
  const original = { root: App.state.root, view: App.state.view, scale: getComputedStyle(document.documentElement).getPropertyValue('--font-scale') };
  const base = await saved.scan(original.root);
  const shapes = [{ width: 900, height: 600 }, { width: 600, height: 900 }, { width: 1800, height: 260 }];
  const fixtures = [
    { shape: 0, formats: ['jpeg', 'raw'] },
    { shape: 1, formats: ['jpeg', 'raw'] },
    { shape: 2, formats: ['raw'] },
    { shape: 0, formats: ['jpeg'] },
  ];
  const photos = fixtures.map((fixture, index) => ({
    ...base.photos[index % base.photos.length], id: `demo-${601 + index}`, name: `Synthetic-fullscreen-${index}.JPG`, stem: `Synthetic fullscreen ${index}`, date: '2026-10-01', favorite: false,
    ...shapes[fixture.shape], jpegPath: fixture.formats.includes('jpeg') ? `/合成全屏/${index}.JPG` : null, rawPath: fixture.formats.includes('raw') ? `/合成全屏/${index}.CR3` : null,
    path: `/合成全屏/${index}.${fixture.formats.includes('jpeg') ? 'JPG' : 'CR3'}`,
  }));
  const sourceCalls = [], transitions = [], listeners = new Set();
  let nativeEnabled = false, snapshotFailure = false, enterFailure = false, nativeDelay = 5;
  const emit = enabled => { nativeEnabled = enabled; for (const listener of [...listeners]) listener({ enabled }); };
  const key = (value, target = document.body) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: value });
    target.dispatchEvent(event); return event;
  };
  const detail = () => document.querySelector('.photo-detail');
  const active = () => detail()?.dataset.photoFullscreen === 'true';
  const fullButton = format => document.querySelector(`[data-viewer-fullscreen="${format}"]`);
  const activeFrame = () => document.querySelector('.is-fullscreen-active .preview-frame');
  const wheel = (frame, deltaY) => {
    const r = frame.getBoundingClientRect();
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, altKey: true, deltaY, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    frame.dispatchEvent(event); return event;
  };
  const fits = frame => {
    const img = frame.querySelector('img'), box = frame.getBoundingClientRect(), style = getComputedStyle(img);
    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    return Number(frame.dataset.zoom) === 1 && Number(frame.dataset.panX) === 0 && Number(frame.dataset.panY) === 0 && style.objectFit === 'contain' && img.naturalWidth * scale <= box.width + 1 && img.naturalHeight * scale <= box.height + 1 && scale > 0;
  };
  const bounded = frame => {
    const width = Number(frame.dataset.baseWidth), height = Number(frame.dataset.baseHeight), zoom = Number(frame.dataset.zoom);
    return Math.abs(Number(frame.dataset.panX)) <= Math.max(0, (width * zoom - frame.clientWidth) / 2) + 1 && Math.abs(Number(frame.dataset.panY)) <= Math.max(0, (height * zoom - frame.clientHeight) / 2) + 1;
  };
  const hit = button => {
    const r = button.getBoundingClientRect(), target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 && (target === button || button.contains(target));
  };
  const open = async index => {
    document.querySelector(`.photo-card[data-id="${photos[index].id}"]`).click();
    await wait(() => App.state.inspectorId === photos[index].id && [...document.querySelectorAll('.preview-frame img')].every(img => img.complete && img.naturalWidth > 0 && Number(img.closest('.preview-frame').dataset.baseWidth) > 0));
    await frames();
  };
  const settle = async () => { await new Promise(resolve => setTimeout(resolve, nativeDelay + 20)); await frames(); };
  try {
    assert(api.isDemo, 'Fullscreen tests use synthetic demo assets only');
    api.scan = async root => ({ root, photos });
    api.source = async ({ id, format }) => {
      const index = photos.findIndex(photo => photo.id === id), fixture = fixtures[index];
      if (!fixture || !fixture.formats.includes(format)) throw new Error('Fullscreen smoke requested a non-synthetic or unavailable original');
      sourceCalls.push({ id, format });
      const { width, height } = shapes[fixture.shape];
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${format === 'raw' ? '#667b69' : '#8fa4af'}"/><rect width="40" height="40" fill="#ed493b"/><rect x="${width - 40}" y="${height - 40}" width="40" height="40" fill="#efb523"/></svg>`);
    };
    api.getPhotoFullscreen = async () => { if (snapshotFailure) throw new Error('Synthetic fullscreen snapshot unavailable'); return { enabled: nativeEnabled }; };
    api.setPhotoFullscreen = async ({ enabled }) => {
      transitions.push(enabled);
      await new Promise(resolve => setTimeout(resolve, nativeDelay));
      if (enabled && enterFailure) throw new Error('Synthetic native transition rejected');
      emit(enabled); return { enabled };
    };
    api.onPhotoFullscreen = callback => { listeners.add(callback); return () => listeners.delete(callback); };
    el('reset-filters').click(); el('sort-order').value = 'date-desc'; document.querySelector('[data-view="all"]').click();
    await App.refresh(original.root);
    for (const fontScale of [1.2, 1.5]) {
      App.applyFontScale(fontScale); await frames();
      await open(0);
      assert(!active() && hit(fullButton('jpeg')), `${fontScale}: visible JPEG fullscreen action is clickable`);
      const input = el('photo-tags'); input.focus();
      const typing = key('f', input);
      assert(!typing.defaultPrevented && !active(), `${fontScale}: typing a tag does not invoke F fullscreen`);
      fullButton('jpeg').click(); await settle();
      assert(active() && nativeEnabled && transitions.at(-1) === true, `${fontScale}: fullscreen button enters the native window through its bridge`);
      const r = detail().getBoundingClientRect();
      assert(r.left === 0 && r.top === 0 && Math.abs(r.width - innerWidth) <= 1 && Math.abs(r.height - innerHeight) <= 1, `${fontScale}: immersive photo covers the complete available window`, r.toJSON());
      const frame = activeFrame();
      assert(fits(frame) && frame.clientHeight > innerHeight * .6, `${fontScale}: fullscreen displays every JPEG edge with a large fitted image`);
      assert(hit(document.querySelector('[data-fullscreen-exit]')) && hit(document.querySelector('[data-fullscreen-navigate="1"]')), `${fontScale}: exit and adjacent-photo actions remain reachable`);
      assert(document.activeElement === frame, `${fontScale}: keyboard focus starts on the fullscreen photo`);
      const normal = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120 }); frame.dispatchEvent(normal);
      assert(!normal.defaultPrevented && Number(frame.dataset.zoom) === 1, `${fontScale}: plain wheel does not change fullscreen scale`);
      const zoom = wheel(frame, -320);
      assert(zoom.defaultPrevented && Number(frame.dataset.zoom) > 2, `${fontScale}: Alt or Option wheel continues to zoom in fullscreen`);
      const box = frame.getBoundingClientRect();
      for (const [type, x, y, buttons] of [['pointerdown', box.left + box.width / 2, box.top + box.height / 2, 1], ['pointermove', box.left + 99999, box.top - 99999, 1], ['pointerup', box.left + 99999, box.top - 99999, 0]]) {
        frame.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'mouse', button: 0, clientX: x, clientY: y, buttons }));
      }
      assert(bounded(frame) && !frame.classList.contains('is-panning'), `${fontScale}: full-window pointer dragging remains bounded and releases cleanly`);
      document.querySelector('[data-fullscreen-format="raw"]').click(); await frames();
      assert(activeFrame().dataset.viewerFormat === 'raw' && fits(activeFrame()), `${fontScale}: CR3 embedded preview can be selected and shows all edges`);
      assert(frame.getClientRects().length === 0 && document.querySelector('[data-fullscreen-format="raw"]').getAttribute('aria-pressed') === 'true', `${fontScale}: only the active format is visible and the selector reports its state`);
      const beforeNavigation = transitions.length;
      const arrow = key('ArrowRight');
      await wait(() => App.state.inspectorId === photos[1].id && activeFrame()?.querySelector('img').complete && Number(activeFrame()?.dataset.baseWidth) > 0); await frames();
      assert(arrow.defaultPrevented && active() && nativeEnabled && transitions.length === beforeNavigation, `${fontScale}: arrow navigation keeps native fullscreen without exit and reentry`);
      assert(activeFrame().dataset.viewerFormat === 'raw' && fits(activeFrame()), `${fontScale}: next portrait preserves the chosen format and resets to complete fit`);
      assert(listeners.size === 1 && !frame.isConnected, `${fontScale}: replacing the detail releases its native listener and old frame`);
      const escape = key('Escape'); await settle();
      assert(escape.defaultPrevented && !active() && !nativeEnabled && App.state.inspectorId === photos[1].id, `${fontScale}: first Esc returns to detail instead of closing the photo`);
      assert(hit(el('inspect-next')) && !detail().classList.contains('is-photo-fullscreen'), `${fontScale}: normal detail layout and navigation recover after Esc`);
      const f = key('f'); await settle();
      assert(f.defaultPrevented && active() && nativeEnabled, `${fontScale}: F enters fullscreen from ordinary detail`);
      key('F'); await settle();
      assert(!active() && !nativeEnabled, `${fontScale}: uppercase F also exits and restores the native window`);
      key('Escape'); await settle();
      assert(!detail() && App.state.inspectorId === null && listeners.size === 0, `${fontScale}: a second Esc closes normal detail and removes fullscreen listeners`);
    }
    App.applyFontScale(1.2);
    await open(1); fullButton('raw').click(); await settle();
    document.querySelector('[data-fullscreen-navigate="1"]').click();
    await wait(() => App.state.inspectorId === photos[2].id && activeFrame()?.querySelector('img').complete && Number(activeFrame()?.dataset.baseWidth) > 0); await frames();
    assert(active() && activeFrame().dataset.viewerFormat === 'raw' && fits(activeFrame()), 'RAW-only panorama remains complete when navigating in fullscreen');
    assert(document.querySelectorAll('[data-fullscreen-format]').length === 1 && document.querySelector('[data-fullscreen-format]').textContent === 'CR3 预览', 'RAW-only fullscreen never offers a missing JPEG');
    document.querySelector('[data-fullscreen-navigate="1"]').click();
    await wait(() => App.state.inspectorId === photos[3].id && activeFrame()?.querySelector('img').complete && Number(activeFrame()?.dataset.baseWidth) > 0); await frames();
    assert(active() && activeFrame().dataset.viewerFormat === 'jpeg' && fits(activeFrame()), 'JPEG-only navigation falls back to its available format');
    const unchanged = transitions.length; key('ArrowRight'); await settle();
    assert(App.state.inspectorId === photos[3].id && active() && transitions.length === unchanged, 'At the last photograph fullscreen stays open without a redundant native transition');
    document.querySelector('[data-fullscreen-exit]').click(); await settle();
    assert(!active() && !nativeEnabled && App.state.inspectorId === photos[3].id, 'Visible exit action restores detail while keeping the photograph open');
    App.closeModal(); await settle();
    await open(0); fullButton('jpeg').click(); await settle(); emit(false); await settle();
    assert(!active() && !nativeEnabled && App.state.inspectorId === photos[0].id, 'Operating-system fullscreen exit also restores detail without reopening the window');
    App.closeModal(); await settle();
    nativeEnabled = true; await open(0); const wasFullCalls = transitions.length;
    fullButton('jpeg').click(); await settle(); App.closeModal(); await settle();
    assert(nativeEnabled && transitions.slice(wasFullCalls).every(Boolean), 'Closing a fullscreen photo preserves a window that was already in system fullscreen');
    nativeEnabled = false; await open(0); fullButton('jpeg').click(); await settle(); App.closeModal(); await settle();
    assert(!nativeEnabled && listeners.size === 0, 'Closing photo detail restores an originally windowed application');
    nativeDelay = 60; await open(0); fullButton('jpeg').click(); key('Escape'); await settle(); await settle();
    assert(!active() && !nativeEnabled && App.state.inspectorId === photos[0].id, 'Esc during an unfinished native transition ends windowed with the detail still open');
    App.closeModal(); await settle(); await open(0); fullButton('jpeg').click(); App.closeModal(); await settle(); await settle();
    assert(!nativeEnabled && listeners.size === 0 && !detail(), 'Closing during an unfinished native transition restores the window and cleans listeners');
    nativeDelay = 5; enterFailure = true; await open(0); fullButton('jpeg').click(); await settle(); await settle();
    assert(!active() && !nativeEnabled && App.state.inspectorId === photos[0].id && [...el('toast-root').children].some(node => node.textContent.includes('Synthetic native transition rejected')), 'Rejected native entry recovers detail and shows the actual error');
    enterFailure = false; App.closeModal(); await settle();
    snapshotFailure = true; await open(0); const snapshotCalls = transitions.length; fullButton('jpeg').click(); await settle(); await settle();
    assert(!active() && transitions.length === snapshotCalls, 'Snapshot failure never changes an unknown native window state');
    snapshotFailure = false; App.closeModal(); await settle();
    const stale = fullButton('jpeg'); key('f'); await settle();
    assert(!detail() && !nativeEnabled && listeners.size === 0 && !stale, 'F outside a photo detail does not enter a stale fullscreen viewer');
    assert(sourceCalls.every(call => { const index = photos.findIndex(photo => photo.id === call.id); return fixtures[index]?.formats.includes(call.format); }), 'Every full-screen source request belongs to a synthetic available format');
  } catch (error) {
    throw new Error(`Fullscreen regression failed after ${checks.at(-1)}: ${error.message}; ${error.stack}`);
  } finally {
    snapshotFailure = false; enterFailure = false; App.closeModal(); await settle();
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete api[name]; else api[name] = value; }
    App.applyFontScale(original.scale); document.querySelector(`[data-view="${original.view}"]`)?.click();
    await App.refresh(original.root); el('toast-root').replaceChildren();
  }
  return { passed: checks.length, checks, bridgeTransitions: transitions.length, sourceRequests: sourceCalls.length, viewport: { width: innerWidth, height: innerHeight } };
})();
