/* Synthetic intrinsic dimensions exercise the real detail dialog, without
 * reading a photo directory or launching an installed photo editor. */
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
    throw new Error(`Detail UI timeout: ${condition.toString()}; inspector=${window.App?.state.inspectorId}`);
  };
  await wait(() => window.App?.api.isDemo && App.state.photos.length && !App.state.scanning);
  const api = App.api;
  const original = { scan: api.scan, source: api.source, openEditor: api.openEditor, root: App.state.root, view: App.state.view, scale: getComputedStyle(document.documentElement).getPropertyValue('--font-scale') };
  const base = await original.scan(original.root);
  const shapes = [{ name: 'landscape', width: 12000, height: 8000 }, { name: 'portrait', width: 8000, height: 12000 }, { name: 'panorama', width: 12000, height: 1200 }];
  const fixtures = ['pair', 'raw-only'].flatMap(mode => shapes.map(shape => ({ ...shape, mode })));
  const photos = fixtures.map((fixture, index) => ({
    ...base.photos[index % base.photos.length], id: `demo-${101 + index}`, name: `Synthetic-${fixture.name}-${fixture.mode}.JPG`, stem: `Synthetic-${fixture.name}-${fixture.mode}`,
    date: '2026-10-01', favorite: false, width: fixture.width, height: fixture.height,
    jpegPath: fixture.mode === 'pair' ? `/合成详情/${index}.JPG` : null, rawPath: `/合成详情/${index}.CR3`, path: `/合成详情/${index}.${fixture.mode === 'pair' ? 'JPG' : 'CR3'}`,
  }));
  const byId = new Map(photos.map((photo, index) => [photo.id, fixtures[index]]));
  const sourceCalls = [], editorCalls = [];
  const image = (fixture, format) => {
    const { width, height } = fixture, edge = Math.min(width, height) * .08;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${format === 'raw' ? '#d9e6d1' : '#e9e4cd'}"/><rect width="${edge}" height="${edge}" fill="#ed493b"/><rect x="${width - edge}" width="${edge}" height="${edge}" fill="#36a667"/><rect y="${height - edge}" width="${edge}" height="${edge}" fill="#3678d7"/><rect x="${width - edge}" y="${height - edge}" width="${edge}" height="${edge}" fill="#efb523"/><path d="M0 0 ${width} ${height}M${width} 0 0 ${height}" stroke="#65827d" stroke-width="${edge * .06}"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  const measure = img => {
    const frame = img.closest('.preview-frame'), box = img.getBoundingClientRect(), outer = frame.getBoundingClientRect(), style = getComputedStyle(img), frameStyle = getComputedStyle(frame);
    const inside = { left: outer.left + parseFloat(frameStyle.borderLeftWidth), top: outer.top + parseFloat(frameStyle.borderTopWidth), right: outer.right - parseFloat(frameStyle.borderRightWidth), bottom: outer.bottom - parseFloat(frameStyle.borderBottomWidth) };
    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const content = { left: box.left + (box.width - img.naturalWidth * scale) / 2, top: box.top + (box.height - img.naturalHeight * scale) / 2 };
    content.right = content.left + img.naturalWidth * scale;
    content.bottom = content.top + img.naturalHeight * scale;
    const contains = rect => rect.left >= inside.left - 1 && rect.top >= inside.top - 1 && rect.right <= inside.right + 1 && rect.bottom <= inside.bottom + 1;
    return { fits: contains(box), complete: style.objectFit === 'contain' && contains(content) && scale > 0, box: box.toJSON(), frame: outer.toJSON(), content, objectFit: style.objectFit, natural: [img.naturalWidth, img.naturalHeight] };
  };
  const hitButton = button => {
    const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 && (hit === button || button.contains(hit));
  };
  const openPhoto = async photo => {
    document.querySelector(`.photo-card[data-id="${photo.id}"]`).click();
    await wait(() => App.state.inspectorId === photo.id && el('preview-raw')?.complete && el('preview-raw').naturalWidth > 0 && (!photo.jpegPath || el('preview-jpeg')?.complete && el('preview-jpeg').naturalWidth > 0));
    await Promise.all([...document.querySelectorAll('.preview-frame img')].map(img => img.decode()));
    await frames();
  };
  let negativeStyle;
  try {
    assert(api.isDemo, 'Detail tests use synthetic demo assets only');
    api.scan = async root => ({ root, photos });
    api.source = async ({ id, format }) => {
      const fixture = byId.get(id);
      if (!fixture) throw new Error('Detail smoke requested a non-synthetic image');
      sourceCalls.push({ id, format });
      return image(fixture, format);
    };
    api.openEditor = async args => { editorCalls.push(args); return { demo: true }; };
    el('reset-filters').click();
    el('sort-order').value = 'date-desc';
    document.querySelector('[data-view="all"]').click();
    await App.refresh(original.root);
    for (const fontScale of [1.2, 1.5]) {
      App.applyFontScale(fontScale);
      await frames();
      for (const [index, photo] of photos.entries()) {
        const fixture = fixtures[index], label = `${fixture.name} ${fixture.mode} at ${Math.round(fontScale * 100)} percent`;
        await openPhoto(photo);
        const modal = el('modal-root').querySelector('.modal'), body = modal.querySelector('.modal-body'), footer = modal.querySelector('.modal-footer'), previews = [...modal.querySelectorAll('.preview-frame img')];
        assert(previews.length === (photo.jpegPath ? 2 : 1) && !!el('preview-jpeg') === !!photo.jpegPath, `${label}: corresponding JPEG and CR3 availability is respected`);
        for (const img of previews) {
          const frame = img.closest('.preview-frame');
          frame.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          await frames();
          const frameRect = frame.getBoundingClientRect(), bodyRect = body.getBoundingClientRect();
          assert(frameRect.top >= bodyRect.top - 1 && frameRect.bottom <= bodyRect.bottom + 1, `${label} ${img.id}: scrolling exposes the entire preview frame`);
          const geometry = measure(img);
          assert(geometry.natural[0] === fixture.width && geometry.natural[1] === fixture.height, `${label} ${img.id}: the full synthetic original was decoded`);
          assert(geometry.fits, `${label} ${img.id}: image border box stays inside its frame`, geometry);
          assert(geometry.complete, `${label} ${img.id}: contain keeps every image edge inside the preview`);
        }
        assert(body.scrollWidth <= body.clientWidth + 1 && modal.scrollWidth <= modal.clientWidth + 1, `${label}: original dimensions do not widen the dialog`);
        const footerRect = footer.getBoundingClientRect();
        assert(footerRect.bottom <= innerHeight + 1 && hitButton(el('inspect-prev')) && hitButton(el('inspect-next')), `${label}: fixed navigation footer remains visible and clickable`);
        for (const button of modal.querySelectorAll('[data-editor]')) {
          button.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          await frames();
          assert(hitButton(button), `${label}: ${button.dataset.format} ${button.dataset.editor} handoff remains reachable`);
          const before = editorCalls.length;
          button.click();
          await wait(() => editorCalls.length === before + 1);
          const call = editorCalls.at(-1);
          assert(call.id === photo.id && call.format === button.dataset.format && call.editor === button.dataset.editor, `${label}: ${button.dataset.format} ${button.dataset.editor} receives the correct selected file`);
        }
        assert(!!el('inspect-edit') === !!photo.jpegPath, `${label}: simple editing is offered only for JPEG`);
        App.closeModal();
      }
    }
    await openPhoto(photos[0]);
    el('inspect-next').click();
    await wait(() => App.state.inspectorId === photos[1].id && el('preview-jpeg')?.naturalHeight === fixtures[1].height);
    assert(measure(el('preview-jpeg')).fits && measure(el('preview-raw')).fits, 'Detail next-photo navigation keeps the new large portrait fitted');
    App.closeModal();
    await openPhoto(photos[0]);
    // Restore the previous intrinsic grid sizing only in this isolated dialog.
    // Its natural-size minimum reproduces the clipped large-original failure.
    negativeStyle = document.createElement('style');
    negativeStyle.textContent = '.inspect-layout{grid-template-columns:1fr 260px!important}.pair-previews{display:grid!important;min-width:auto!important;min-height:auto!important}.preview-frame{display:grid!important;grid-template-columns:none!important;grid-template-rows:none!important;place-items:center!important;min-width:auto!important;min-height:auto!important;height:270px!important;overflow:hidden!important}.preview-frame img{width:100%!important;height:100%!important;min-width:auto!important;min-height:auto!important;max-width:none!important;max-height:none!important;object-fit:contain!important;position:static!important}';
    document.head.append(negativeStyle);
    await frames();
    const negative = measure(el('preview-jpeg'));
    assert(!negative.fits || !negative.complete, 'Negative control detects the previous intrinsic-grid clipping', negative);
    negativeStyle.remove();
    negativeStyle = null;
    await frames();
    assert(measure(el('preview-jpeg')).fits && measure(el('preview-jpeg')).complete, 'Removing the negative control restores the complete preview');
    assert(sourceCalls.every(call => byId.has(call.id) && (byId.get(call.id).mode !== 'raw-only' || call.format === 'raw')), 'RAW-only details never request a missing JPEG');
  } catch (error) {
    throw new Error(`Detail regression failed after ${checks.at(-1)}: ${error.message}; ${error.stack}`);
  } finally {
    negativeStyle?.remove();
    App.closeModal();
    api.scan = original.scan;
    api.source = original.source;
    api.openEditor = original.openEditor;
    App.applyFontScale(original.scale);
    document.querySelector(`[data-view="${original.view}"]`)?.click();
    await App.refresh(original.root);
    el('toast-root').replaceChildren();
  }
  return { passed: checks.length, checks, fixture: shapes, sourceRequests: sourceCalls.length, editorHandoffs: editorCalls.length, viewport: { width: innerWidth, height: innerHeight } };
})();
