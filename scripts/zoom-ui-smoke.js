/* Exercise real detail wheel/pointer handlers with synthetic originals only.
 * Synthetic wheel events cannot perform native default scrolling, so normal
 * wheel coverage checks that it is unclaimed and the body remains scrollable. */
(async () => {
  const checks = [];
  const assert = (condition, label, details) => { if (!condition) throw new Error(label + (details ? ` ${JSON.stringify(details)}` : '')); checks.push(label); };
  const el = id => document.getElementById(id);
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = async condition => {
    for (let attempt = 0; attempt < 220; attempt++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Zoom UI timeout: ${condition.toString()}; inspector=${window.App?.state.inspectorId}`);
  };
  await wait(() => window.App?.api.isDemo && window.PhotoViewer && App.state.photos.length && !App.state.scanning);
  const api = App.api;
  const original = { scan: api.scan, source: api.source, root: App.state.root, view: App.state.view, scale: getComputedStyle(document.documentElement).getPropertyValue('--font-scale') };
  const base = await original.scan(original.root);
  const shapes = [{ name: 'landscape', width: 12000, height: 8000 }, { name: 'portrait', width: 8000, height: 12000 }, { name: 'panorama', width: 12000, height: 1200 }];
  const fixtures = ['pair', 'raw-only', 'jpeg-only'].flatMap(mode => shapes.map(shape => ({ ...shape, mode })));
  const photos = fixtures.map((fixture, index) => ({
    ...base.photos[index % base.photos.length], id: `demo-${201 + index}`, name: `Synthetic-zoom-${fixture.name}-${fixture.mode}`, stem: `Synthetic-zoom-${fixture.name}-${fixture.mode}`,
    date: '2026-10-01', favorite: false, width: fixture.width, height: fixture.height,
    jpegPath: fixture.mode === 'raw-only' ? null : `/合成缩放/${index}.JPG`, rawPath: fixture.mode === 'jpeg-only' ? null : `/合成缩放/${index}.CR3`,
    path: `/合成缩放/${index}.${fixture.mode === 'raw-only' ? 'CR3' : 'JPG'}`,
  }));
  const byId = new Map(photos.map((photo, index) => [photo.id, fixtures[index]]));
  const sourceCalls = [];
  const image = (fixture, format) => {
    const { width, height } = fixture, edge = Math.min(width, height) * .08;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${format === 'raw' ? '#d9e6d1' : '#e9e4cd'}"/><rect width="${edge}" height="${edge}" fill="#ed493b"/><rect x="${width - edge}" width="${edge}" height="${edge}" fill="#36a667"/><rect y="${height - edge}" width="${edge}" height="${edge}" fill="#3678d7"/><rect x="${width - edge}" y="${height - edge}" width="${edge}" height="${edge}" fill="#efb523"/><path d="M0 0 ${width} ${height}M${width} 0 0 ${height}" stroke="#65827d" stroke-width="${edge * .06}"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  // Measure the painted contain rectangle independently of viewer data. The
  // transformed img border box also includes any letterbox area.
  const geometry = frame => {
    const img = frame.querySelector('img'), box = img.getBoundingClientRect(), outer = frame.getBoundingClientRect();
    const imageStyle = getComputedStyle(img), frameStyle = getComputedStyle(frame);
    const baseWidth = parseFloat(imageStyle.width), baseHeight = parseFloat(imageStyle.height);
    const fit = Math.min(baseWidth / img.naturalWidth, baseHeight / img.naturalHeight);
    const scaleX = box.width / baseWidth, scaleY = box.height / baseHeight;
    const width = img.naturalWidth * fit * scaleX, height = img.naturalHeight * fit * scaleY;
    const content = { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
    content.right = content.left + width; content.bottom = content.top + height;
    const inside = { left: outer.left + parseFloat(frameStyle.borderLeftWidth), top: outer.top + parseFloat(frameStyle.borderTopWidth), width: outer.width - parseFloat(frameStyle.borderLeftWidth) - parseFloat(frameStyle.borderRightWidth), height: outer.height - parseFloat(frameStyle.borderTopWidth) - parseFloat(frameStyle.borderBottomWidth) };
    inside.right = inside.left + inside.width; inside.bottom = inside.top + inside.height;
    return { box: box.toJSON(), content, inside, scale: Number(frame.dataset.zoom), pan: [Number(frame.dataset.panX), Number(frame.dataset.panY)], natural: [img.naturalWidth, img.naturalHeight], fit: imageStyle.objectFit };
  };
  const fitted = frame => {
    const { content: c, inside: f, scale, pan, fit } = geometry(frame);
    return scale === 1 && pan.every(value => Math.abs(value) < .01) && fit === 'contain' && c.width > 0 && c.height > 0 && c.left >= f.left - 1 && c.top >= f.top - 1 && c.right <= f.right + 1 && c.bottom <= f.bottom + 1;
  };
  const bounded = frame => {
    const { content: c, inside: f } = geometry(frame);
    const axis = (start, end, size, frameStart, frameEnd, frameSize) => size >= frameSize - 1 ? start <= frameStart + 1 && end >= frameEnd - 1 : Math.abs((start + end) / 2 - (frameStart + frameEnd) / 2) <= 1;
    return axis(c.left, c.right, c.width, f.left, f.right, f.width) && axis(c.top, c.bottom, c.height, f.top, f.bottom, f.height);
  };
  const anchor = frame => {
    const { content: c, inside: f } = geometry(frame);
    return { x: (c.left + c.right) / 2 + (c.width >= f.width - 1 ? c.width * .08 : 0), y: (c.top + c.bottom) / 2 + (c.height >= f.height - 1 ? c.height * .08 : 0) };
  };
  const centre = frame => {
    const box = frame.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  const wheel = (frame, deltaY, altKey = true, point = centre(frame), deltaMode = 0) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, altKey, deltaY, deltaMode, clientX: point.x, clientY: point.y });
    frame.dispatchEvent(event);
    return event;
  };
  const drag = (frame, dx, dy, end = 'pointerup') => {
    const box = frame.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    const event = (type, clientX, clientY, buttons) => frame.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 19, pointerType: 'mouse', isPrimary: true, button: 0, buttons, clientX, clientY }));
    event('pointerdown', x, y, 1); event('pointermove', x + dx, y + dy, 1); event(end, x + dx, y + dy, 0);
  };
  const resetButton = frame => frame.closest('.preview-block').querySelector(`[data-viewer-reset="${frame.dataset.viewerFormat}"]`);
  const hitButton = button => {
    const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 && (hit === button || button.contains(hit));
  };
  const openPhoto = async photo => {
    document.querySelector(`.photo-card[data-id="${photo.id}"]`).click();
    await wait(() => App.state.inspectorId === photo.id && [...document.querySelectorAll('.photo-detail .preview-frame img')].length === (photo.jpegPath && photo.rawPath ? 2 : 1) && [...document.querySelectorAll('.photo-detail .preview-frame img')].every(img => img.complete && img.naturalWidth > 0 && Number(img.closest('.preview-frame').dataset.baseWidth) > 0));
    await Promise.all([...document.querySelectorAll('.photo-detail .preview-frame img')].map(img => img.decode()));
    await frames();
  };
  let negativeStyle;
  try {
    assert(api.isDemo, 'Zoom tests use synthetic demo photographs only');
    api.scan = async root => ({ root, photos });
    api.source = async ({ id, format }) => {
      const fixture = byId.get(id);
      if (!fixture) throw new Error('Zoom smoke requested a non-synthetic original');
      sourceCalls.push({ id, format });
      return image(fixture, format);
    };
    el('reset-filters').click(); el('sort-order').value = 'date-desc';
    document.querySelector('[data-view="all"]').click();
    await App.refresh(original.root);
    for (const fontScale of [1.2, 1.5]) {
      App.applyFontScale(fontScale); await frames();
      for (const [index, photo] of photos.entries()) {
        const fixture = fixtures[index], label = `${fixture.name} ${fixture.mode} at ${Math.round(fontScale * 100)} percent`;
        await openPhoto(photo);
        const modal = el('modal-root').querySelector('.modal'), body = modal.querySelector('.modal-body'), previews = [...modal.querySelectorAll('.preview-frame')];
        assert(!!el('preview-jpeg') === !!photo.jpegPath && !!el('preview-raw') === !!photo.rawPath, `${label}: available formats have separate previews`);
        for (const frame of previews) {
          const format = frame.dataset.viewerFormat, prefix = `${label} ${format}`, img = frame.querySelector('img');
          frame.scrollIntoView({ block: 'nearest', behavior: 'instant' }); await frames();
          assert(fitted(frame), `${prefix}: default view keeps every image edge fitted`, geometry(frame));
          assert(img.naturalWidth === fixture.width && img.naturalHeight === fixture.height, `${prefix}: full synthetic intrinsic dimensions are used`);
          assert(img.draggable === false && frame.tabIndex === 0, `${prefix}: native image dragging is disabled and preview is keyboard reachable`);
          const plainBefore = geometry(frame), plain = wheel(frame, -120, false);
          assert(!plain.defaultPrevented && Number(frame.dataset.zoom) === 1 && Math.abs(geometry(frame).box.width - plainBefore.box.width) < .01, `${prefix}: ordinary wheel is unclaimed and does not zoom`);
          const scrollMax = body.scrollHeight - body.clientHeight;
          if (scrollMax > 1) {
            const oldTop = body.scrollTop;
            body.scrollTop = oldTop > scrollMax / 2 ? Math.max(0, oldTop - 35) : Math.min(scrollMax, oldTop + 35);
            assert(Math.abs(body.scrollTop - oldTop) > 1, `${prefix}: overflowing detail content remains scrollable`);
            frame.scrollIntoView({ block: 'nearest', behavior: 'instant' }); await frames();
          }
          const point = anchor(frame), before = geometry(frame), normalized = { x: (point.x - before.content.left) / before.content.width, y: (point.y - before.content.top) / before.content.height };
          const other = previews.find(preview => preview !== frame), otherBefore = other && geometry(other);
          const zoomEvent = wheel(frame, -120, true, point);
          const after = geometry(frame), ratio = after.content.width / before.content.width;
          assert(zoomEvent.defaultPrevented && ratio > 1.1 && after.scale > 1, `${prefix}: Alt / Option wheel actually enlarges the photograph`, { before, after });
          assert(Math.abs(after.content.width / before.content.width - after.content.height / before.content.height) < .001, `${prefix}: zoom preserves the image aspect ratio`);
          assert(Math.abs(after.content.left + normalized.x * after.content.width - point.x) <= 1.5 && Math.abs(after.content.top + normalized.y * after.content.height - point.y) <= 1.5, `${prefix}: the image pixel under the off-centre mouse stays anchored`, { point, before, after });
          assert(el(`zoom-${format}`).textContent === `${Math.round(after.scale * 100)}%`, `${prefix}: visible zoom percentage matches actual geometry`);
          if (other) assert(Number(other.dataset.zoom) === otherBefore.scale && Math.abs(geometry(other).content.width - otherBefore.content.width) < .01, `${prefix}: paired format zoom stays independent`);
          const panBefore = geometry(frame);
          drag(frame, 12, 12);
          const panAfter = geometry(frame);
          assert(Math.abs(panAfter.content.left - panBefore.content.left) > 1 || Math.abs(panAfter.content.top - panBefore.content.top) > 1, `${prefix}: pointer drag visibly pans a zoomed photograph`);
          assert(App.state.inspectorId === photo.id && frame.isConnected && !frame.classList.contains('is-panning'), `${prefix}: releasing a drag does not change the selected photograph`);
          const larger = Number(frame.dataset.zoom);
          wheel(frame, 60);
          assert(Number(frame.dataset.zoom) > 1 && Number(frame.dataset.zoom) < larger, `${prefix}: reverse wheel reduces magnification`);
          for (let turn = 0; turn < 8; turn++) wheel(frame, -400);
          const maximum = Number(frame.dataset.maxZoom), atLimit = geometry(frame);
          assert(maximum === PhotoViewer.maxZoom && maximum >= 2 && maximum <= 64 && atLimit.scale === maximum, `${prefix}: zoom reaches its declared finite upper limit`);
          wheel(frame, -400);
          assert(Number(frame.dataset.zoom) === maximum && Math.abs(geometry(frame).content.width - atLimit.content.width) < .01, `${prefix}: repeated enlargement cannot exceed the limit`);
          drag(frame, 10000, 10000);
          assert(bounded(frame), `${prefix}: positive pan stops at actual photo-content edges`, geometry(frame));
          drag(frame, -10000, -10000, 'pointercancel');
          assert(bounded(frame) && !frame.classList.contains('is-panning'), `${prefix}: negative pan and pointer cancellation remain bounded`, geometry(frame));
          for (let turn = 0; turn < 8; turn++) wheel(frame, 400);
          assert(fitted(frame), `${prefix}: reverse wheel returns to fit and cannot shrink below it`, geometry(frame));
          const fitBefore = geometry(frame);
          drag(frame, 200, 200);
          assert(fitted(frame) && Math.abs(geometry(frame).content.left - fitBefore.content.left) < .01, `${prefix}: dragging at fit does not displace the photograph`);
          wheel(frame, -400);
          const reset = resetButton(frame);
          reset.scrollIntoView({ block: 'nearest', behavior: 'instant' }); await frames();
          assert(hitButton(reset), `${prefix}: fit reset remains visible and clickable`);
          reset.click();
          assert(fitted(frame) && el(`zoom-${format}`).textContent === '100%', `${prefix}: reset restores the complete original aspect ratio`);
          const alt = new KeyboardEvent('keydown', { key: 'Alt', bubbles: true, cancelable: true });
          frame.dispatchEvent(alt);
          assert(alt.defaultPrevented, `${prefix}: Alt key is claimed within the viewer to avoid menu activation`);
          wheel(frame, -120); frame.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          assert(fitted(frame), `${prefix}: double click restores fit`);
          frame.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
          assert(Number(frame.dataset.zoom) > 1, `${prefix}: keyboard zoom remains available`);
          frame.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true }));
          assert(fitted(frame), `${prefix}: keyboard zero restores fit`);
        }
        assert(body.scrollWidth <= body.clientWidth + 1 && modal.scrollWidth <= modal.clientWidth + 1, `${label}: zoomed and fitted detail content never widens the dialog`);
        assert(hitButton(el('inspect-prev')) && hitButton(el('inspect-next')), `${label}: photo navigation remains reachable`);
        App.closeModal();
      }
    }
    await openPhoto(photos[0]);
    const resized = el('preview-jpeg').closest('.preview-frame');
    wheel(resized, -400);
    const originalWidth = resized.clientWidth;
    resized.style.width = '72%';
    await wait(() => resized.clientWidth < originalWidth - 20 && Number(resized.dataset.zoom) === 1);
    assert(fitted(resized), 'Changing real preview dimensions resets zoom and refits the whole image', geometry(resized));
    resized.style.width = '';
    await wait(() => resized.clientWidth === originalWidth && Number(resized.dataset.zoom) === 1);
    assert(fitted(resized), 'Restoring preview dimensions keeps fit geometry valid');
    App.applyFontScale(1.2); await frames();
    wheel(resized, -400);
    App.applyFontScale(1.5); await frames();
    assert(bounded(resized) && el('modal-root').querySelector('.modal').scrollWidth <= el('modal-root').querySelector('.modal').clientWidth + 1, 'Increasing fonts in an open zoomed dialog keeps photo bounds and compact layout valid');
    resetButton(resized).scrollIntoView({ block: 'nearest', behavior: 'instant' }); await frames();
    assert(hitButton(resetButton(resized)), 'Fit control remains accessible after live font-size changes');
    resetButton(resized).click();
    assert(fitted(resized), 'Fit remains complete after live font-size changes');
    // Changing viewer state alone is insufficient: the geometry detector must
    // reject a preview whose transform is broken while its status still updates.
    const beforeNegative = geometry(resized);
    negativeStyle = document.createElement('style');
    negativeStyle.textContent = '.photo-viewer-frame img { transform: none !important; }';
    document.head.append(negativeStyle);
    wheel(resized, -400);
    const negative = geometry(resized);
    assert(negative.scale > 1 && negative.content.width / beforeNegative.content.width <= 1.001, 'Negative control detects a broken image transform despite a changed zoom status', { beforeNegative, negative });
    negativeStyle.remove(); negativeStyle = null;
    resetButton(resized).click(); wheel(resized, -120);
    assert(geometry(resized).content.width / beforeNegative.content.width > 1.1, 'Removing the broken-transform control restores visible enlargement');
    const blockWheel = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    resetButton(resized).click();
    resized.addEventListener('wheel', blockWheel, true);
    try {
      wheel(resized, -400);
      assert(fitted(resized), 'Negative control detects an inactive Alt wheel handler');
    } finally { resized.removeEventListener('wheel', blockWheel, true); }
    wheel(resized, -120);
    assert(Number(resized.dataset.zoom) > 1, 'Alt wheel responds again after the blocked-handler control is removed');
    const stale = resized, staleImage = stale.querySelector('img');
    el('inspect-next').click();
    await wait(() => App.state.inspectorId === photos[1].id && el('preview-jpeg')?.naturalHeight === fixtures[1].height && Number(el('preview-jpeg').closest('.preview-frame').dataset.baseHeight) > 0);
    await frames();
    assert(fitted(el('preview-jpeg').closest('.preview-frame')) && fitted(el('preview-raw').closest('.preview-frame')), 'Next-photo navigation creates newly fitted independent previews');
    const staleTransform = staleImage.style.transform, staleZoom = stale.dataset.zoom;
    const detachedWheel = wheel(stale, -400, true, { x: 10, y: 10 });
    drag(stale, 400, 400);
    assert(!stale.isConnected && !detachedWheel.defaultPrevented && staleImage.style.transform === staleTransform && stale.dataset.zoom === staleZoom, 'Switching photographs removes old preview wheel and pointer listeners');
    App.closeModal();
    let firstGestureRatio;
    for (let cycle = 0; cycle < 4; cycle++) {
      await openPhoto(photos[0]);
      const current = el('preview-jpeg').closest('.preview-frame'), currentImage = current.querySelector('img');
      assert(fitted(current), `Reopen ${cycle + 1}: fit state does not leak from a previous dialog`);
      const oldWidth = geometry(current).content.width;
      wheel(current, -120);
      const gestureRatio = geometry(current).content.width / oldWidth;
      if (firstGestureRatio === undefined) firstGestureRatio = gestureRatio;
      assert(gestureRatio > 1.1 && Math.abs(gestureRatio - firstGestureRatio) < .001, `Reopen ${cycle + 1}: one wheel gesture has one consistent effect`);
      App.closeModal();
      const transform = currentImage.style.transform, dataZoom = current.dataset.zoom;
      const closedWheel = wheel(current, -400, true, { x: 10, y: 10 });
      assert(!closedWheel.defaultPrevented && currentImage.style.transform === transform && current.dataset.zoom === dataZoom, `Reopen ${cycle + 1}: closing removes the previous dialog listeners`);
    }
    assert(sourceCalls.every(call => byId.has(call.id) && (byId.get(call.id).mode !== 'raw-only' || call.format === 'raw') && (byId.get(call.id).mode !== 'jpeg-only' || call.format === 'jpeg')), 'RAW-only and JPEG-only details never request a missing paired file');
  } catch (error) {
    throw new Error(`Zoom regression failed after ${checks.at(-1)}: ${error.message}; ${error.stack}`);
  } finally {
    negativeStyle?.remove(); App.closeModal();
    api.scan = original.scan; api.source = original.source;
    App.applyFontScale(original.scale);
    document.querySelector(`[data-view="${original.view}"]`)?.click();
    await App.refresh(original.root); el('toast-root').replaceChildren();
  }
  return { passed: checks.length, checks, shapes, sourceRequests: sourceCalls.length, viewport: { width: innerWidth, height: innerHeight } };
})();
