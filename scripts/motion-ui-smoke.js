/* Synthetic-only motion editor checks, with real native multi-frame GIF encoding. */
(async () => {
  const checks = [], el = id => document.getElementById(id), pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (condition, label, details) => { if (!condition) throw new Error(label + (details ? ' ' + JSON.stringify(details) : '')); checks.push(label); };
  const wait = async test => { for (let i = 0; i < 800; i++) { if (test()) return; await pause(20); } throw new Error('Motion timeout: ' + test.toString()); };
  const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const change = (id, value, type = 'change') => { el(id).value = String(value); el(id).dispatchEvent(new Event(type, { bubbles: true })); };
  const pointer = (target, type, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 71, button: 0, clientX: x, clientY: y }));
  await wait(() => window.App?.api.isDemo && App.state.photos.length && !App.state.scanning);
  const api = App.api, photos = App.state.photos.slice(0, 7), saved = [], encoded = [];
  const originals = { saveImage: api.saveImage, previewGif: api.previewGif, thumbnail: App.thumbnail, font: getComputedStyle(document.documentElement).getPropertyValue('--font-scale') };
  api.saveImage = async args => { saved.push(args); return { canceled: true }; };
  api.previewGif = async args => { encoded.push(JSON.parse(JSON.stringify(args))); return originals.previewGif(args); };
  try {
    // A delayed thumbnail completion must never replace a newer dialog.
    let release; const held = new Promise(resolve => release = resolve);
    App.thumbnail = async (...args) => { await held; return originals.thumbnail(...args); };
    const opening = MotionStudio.open(photos);
    await wait(() => document.querySelector('[aria-label="正在展开这一卷回忆…"]'));
    App.modal({ title: '后来打开的设置', body: '<p>保持当前窗口</p>' }); release(); await opening;
    assert(document.querySelector('[aria-label="后来打开的设置"]') && !el('motion-canvas'), 'A late preview load preserves a newer dialog');
    App.closeModal(); App.thumbnail = originals.thumbnail;
    await MotionStudio.open(photos.slice(0, 1)); await paint();
    assert(el('motion-generate').disabled && !el('motion-save-sticker').disabled, 'One photo can create a static sticker while animated GIF needs two frames');
    el('motion-add-text').click(); change('motion-text', 'SYNTHETIC MEME', 'input'); el('motion-save-sticker').click();
    await wait(() => saved.length === 1 && !el('motion-save-sticker').disabled);
    assert(/^data:image\/png;base64,/.test(saved[0].dataUrl) && saved[0].suggestedName.endsWith('.png'), 'Static sticker exports a real PNG with selected photo and text');
    App.closeModal(); await MotionStudio.open(photos); await paint();
    assert(document.querySelector('.motion-studio') && !el('motion-generate').disabled && el('motion-save').disabled, 'Seven selected photos mount the desktop GIF editor with save gated on real encoding');
    assert(el('motion-scale-label').textContent === '100%' && el('motion-delay').value === '700', 'Compression ratio and frame timing have readable defaults');
    const initialWidth = el('motion-canvas').width; change('motion-scale', 50, 'input'); change('motion-colors', 128); await paint();
    assert(el('motion-canvas').width === Math.floor(initialWidth / 2) && el('motion-scale-label').textContent === '50%', 'Changing output compression ratio resizes the actual output canvas');
    change('motion-delay', 300); assert(el('motion-delay').value === '300', 'Frame duration applies before encoding');
    el('motion-add-speech').click(); change('motion-text', 'THE LIGHT STAYS', 'input'); change('motion-font', 7, 'input'); await paint();
    assert(el('motion-overlays').textContent.includes('THE LIGHT STAYS') && el('motion-font-label').textContent.includes('px'), 'Per-photo bubble text and its actual pixel font size are visible');
    const canvas = el('motion-canvas'), box = canvas.getBoundingClientRect();
    pointer(canvas, 'pointerdown', box.left + box.width * .18, box.top + box.height * .16); pointer(canvas, 'pointermove', box.left + box.width * .34, box.top + box.height * .32); pointer(canvas, 'pointerup', box.left + box.width * .34, box.top + box.height * .32); await paint();
    const strip = el('motion-filmstrip'); const wheel = new WheelEvent('wheel', { deltaY: 90, bubbles: true, cancelable: true }); strip.dispatchEvent(wheel); await paint();
    assert(wheel.defaultPrevented && el('motion-position').textContent.startsWith('2 /'), 'Wheel browsing advances one frame without scrolling the dialog');
    assert(el('motion-overlays').children.length === 0, 'A bubble belongs to its own photo rather than every frame');
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); await paint();
    assert(el('motion-position').textContent.startsWith('3 /'), 'Filmstrip arrows advance the current frame');
    el('motion-film-track').querySelector('[data-index="3"]').click(); await paint();
    assert(el('motion-film-track').querySelectorAll('.motion-film-frame:not(.distant):not(.active)').length === 2 && el('motion-film-track').querySelectorAll('.distant').length === 4, 'Current frame and adjacent two remain sharp while distant frames blur');
    const names = [...el('motion-film-track').querySelectorAll('img')].map(img => img.alt), transfer = new DataTransfer(), first = el('motion-film-track').firstElementChild, last = el('motion-film-track').lastElementChild;
    first.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer })); last.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })); await paint();
    assert(JSON.stringify([...el('motion-film-track').querySelectorAll('img')].map(img => img.alt)) === JSON.stringify([...names.slice(1), names[0]]), 'Dragging the first film frame to the end preserves all photos in the new order');
    el('motion-film-track').lastElementChild.click(); await paint();
    assert(el('motion-overlays').textContent.includes('THE LIGHT STAYS'), 'Reordering preserves a photo’s bubble and text');
    el('motion-overlays').firstElementChild.click(); await paint();
    for (const font of [1.2, 1.5]) {
      App.applyFontScale(font); await paint(); const modal = document.querySelector('.motion-studio'), body = modal.querySelector('.modal-body'), footer = el('motion-save').getBoundingClientRect();
      assert(modal.scrollWidth <= modal.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1, Math.round(font * 100) + '% font: editor has no horizontal overflow');
      assert(footer.top >= 0 && footer.bottom <= innerHeight + 1, Math.round(font * 100) + '% font: GIF save button stays in the window');
      el('motion-font').scrollIntoView({ block: 'nearest', behavior: 'instant' }); await paint(); const control = el('motion-font').getBoundingClientRect(), viewport = body.getBoundingClientRect();
      assert(control.top >= viewport.top - 1 && control.bottom <= viewport.bottom + 1, Math.round(font * 100) + '% font: bubble font setting remains reachable by scrolling', { control: control.toJSON(), viewport: viewport.toJSON(), scroll: body.scrollTop });
    }
    App.applyFontScale(1.2); document.querySelector('.motion-studio .modal-body').scrollTop = 0;
    el('motion-generate').click(); await wait(() => !el('motion-save').disabled && !el('motion-result').hidden && el('motion-result').complete);
    const result = el('motion-result'), bytes = atob(result.src.slice(result.src.indexOf(',') + 1));
    assert(bytes.startsWith('GIF89a') && result.naturalWidth === 480 && result.naturalHeight === 320, 'Preview is a real encoded GIF with the chosen compressed output size');
    assert(encoded.at(-1).frames.length === 7 && encoded.at(-1).frames.at(-1).id === photos[0].id && encoded.at(-1).frames.at(-1).overlays[0].text === 'THE LIGHT STAYS', 'Native encoder receives every selected photo in drag order and its own text');
    const moved = encoded.at(-1).frames.at(-1).overlays[0]; assert(moved.x > .2 && moved.y > .2, 'Dragging moves the bubble’s normalized coordinates in the actual encoder request', moved);
    assert(encoded.at(-1).colors === 128 && encoded.at(-1).delay === 300, 'Native encoding uses chosen palette and timing rather than only changing the preview');
    assert(el('motion-status').textContent.includes('MB') && el('motion-frame-label').textContent.includes('实际编码'), 'Actual encoded file size and preview status are shown');
    el('motion-save').click(); await wait(() => !el('motion-save').disabled && document.body.innerText.includes('GIF 动图已保存'));
    assert(document.body.innerText.includes('GIF 动图已保存'), 'The native save bridge writes the real preview GIF without re-encoding');
    const prior = result.src; change('motion-scale', 35, 'input');
    assert(el('motion-save').disabled && el('motion-result').hidden && !el('motion-result').hasAttribute('src') && prior.startsWith('data:image/gif'), 'Editing a setting releases obsolete encoded preview and prevents saving stale bytes');
    App.closeModal(); await paint(); assert(!document.querySelector('.motion-studio'), 'Closing disposes the editor and preview');
    return { syntheticOnly: true, nativeGifEncoding: true, passed: checks.length, viewport: [innerWidth, innerHeight], checks };
  } finally { App.closeModal(); api.saveImage = originals.saveImage; api.previewGif = originals.previewGif; App.thumbnail = originals.thumbnail; App.applyFontScale(originals.font); }
})();
