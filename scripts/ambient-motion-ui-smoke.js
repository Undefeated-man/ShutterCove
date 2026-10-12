/* Runs inside the real Electron renderer with synthetic photo assets only. */
(async () => {
  const checks = [], pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const assert = (ok, label, detail) => { if (!ok) throw new Error(label + (detail ? ' ' + JSON.stringify(detail) : '')); checks.push(label); };
  const wait = async predicate => { for (let i = 0; i < 500; i++) { if (predicate()) return; await pause(20); } throw new Error('Motion UI timed out: ' + predicate); };
  const $ = id => document.getElementById(id), motion = () => window.AmbientMotion;
  const layers = () => document.querySelectorAll('.motion-photo-layer,.motion-backdrop-layer,.motion-detail-shell');
  const rectangle = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  await wait(() => window.App?.state.settingsReady && App.state.photos.length && motion());
  assert(App.api.isDemo, 'Motion QA uses synthetic photos, with no production profile');
  const original = App.state.photos, selected = App.state.selected, selectionMode = App.state.selectionMode;
  const grid = $('photo-grid'), scroll = $('main-scroll');
  const originalSource = App.api.source;
  const pointer = (button, type, id = 991) => button.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: id }));
  const cards = () => [...grid.querySelectorAll('.photo-card')];
  const activeEntrance = node => node.getAnimations().filter(animation => ['running', 'pending'].includes(animation.playState));
  try {
    App.closeModal();
    document.querySelector('[data-view="all"]').click();
    App.state.selectionMode = false; App.state.selected = new Set();
    App.state.photos = original.map((photo, index) => ({ ...photo, id: 'motion-' + index }));
    // Demo thumbnails use metadata rather than a native lookup, so remapping IDs
    // is safe and provides a genuinely new gallery batch for entrance checks.
    App.render();
    scroll.scrollTop += grid.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 210;
    if (!motion().reduced()) await wait(() => cards().some(node => activeEntrance(node).length));
    else await paint();
    const batch = cards().filter(node => activeEntrance(node).length);
    if (motion().reduced()) {
      assert(batch.length === 0, 'Reduced motion skips all gallery spring transforms');
      assert(cards().every(node => !node.classList.contains('motion-await')), 'Reduced motion renders every card immediately without stagger delays');
      const button = $('select-mode');
      pointer(button, 'pointerdown'); await pause(60);
      assert(getComputedStyle(button).scale === 'none' || Number(getComputedStyle(button).scale) === 1, 'Reduced motion keeps pressed buttons at their natural scale');
      pointer(button, 'pointerup');
      assert(!button.getAnimations().length, 'Reduced motion skips release overshoot');
      App.state.photos = original; App.render(); await paint();
      const card = cards().find(node => node.getBoundingClientRect().top < scroll.getBoundingClientRect().bottom);
      card.click(); await wait(() => document.querySelector('.photo-detail'));
      assert(layers().length === 0, 'Reduced motion opens photo details without decorative shared layers');
      assert(document.querySelector('.photo-detail').getAnimations().length === 0, 'Reduced motion skips detail container scaling');
      App.closeModal();
      assert(layers().length === 0, 'Reduced motion closes details immediately without reverse animation');
      return { reduced: true, passed: checks.length, checks };
    }
    assert(batch.length >= 2, 'Visible new gallery cards begin staggered spring entrances');
    const delays = batch.map(node => Number(node.dataset.motionDelay));
    assert(new Set(delays).size >= 2 && Math.max(...delays) <= 288, 'Cascade has distinct stagger delays, bounded to 288 ms', delays);
    const entering = batch.find(node => Number(node.dataset.motionDelay) === 0) || batch[0];
    await pause(65);
    assert(getComputedStyle(entering).transform !== 'none', 'Gallery card has a real upward transform while entering');
    const pending = cards().filter(node => node.classList.contains('motion-await'));
    assert(pending.length > 0 && pending.every(node => !activeEntrance(node).length), 'Offscreen cards wait for visibility without starting animations');
    await pause(830);
    assert(batch.every(node => !activeEntrance(node).length && !node.style.willChange), 'Entrance completion removes animations and temporary compositing hints');
    App.render(); await paint();
    assert(cards().filter(node => batch.some(old => old.dataset.id === node.dataset.id)).every(node => !activeEntrance(node).length), 'Metadata or selection rerenders do not replay already seen cards');
    const before = cards().length;
    const select = $('select-mode');
    pointer(select, 'pointerdown'); await pause(120);
    assert(Math.abs(Number(getComputedStyle(select).scale) - .96) < .002, 'Pointer press compresses a button to scale 0.96');
    assert(getComputedStyle(select).boxShadow.includes('inset'), 'Pressed button receives visible inset depth');
    pointer(select, 'pointerup');
    let maximumScale = 0;
    for (let i = 0; i < 12; i++) { await pause(16); maximumScale = Math.max(maximumScale, parseFloat(getComputedStyle(select).scale) || 1); }
    assert(maximumScale > 1, 'Release overshoots gently before settling', { maximumScale });
    await pause(200);
    assert(select.getAnimations().length === 0 && !select.classList.contains('motion-button-pressed'), 'Button release removes animated scale and pressed depth');
    const disabled = document.createElement('button'); disabled.disabled = true; document.body.append(disabled);
    pointer(disabled, 'pointerdown');
    assert(!disabled.getAnimations().length && !disabled.classList.contains('motion-button-pressed'), 'Disabled buttons do not enter a press animation');
    disabled.remove();
    select.focus(); select.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); await pause(120);
    assert(Math.abs(Number(getComputedStyle(select).scale) - .96) < .002, 'Keyboard activation receives the same physical press feedback');
    select.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); await pause(380);
    assert(!select.getAnimations().length && cards().length === before, 'Keyboard spring settles without preventing gallery interaction');
    pointer(select, 'pointerdown'); select.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 991 }));
    assert(!select.getAnimations().length && !select.classList.contains('motion-button-pressed'), 'Canceled pointer gestures clear press state immediately');
    App.state.photos = original; App.state.selectionMode = false; App.render();
    const first = cards().find(node => node.getBoundingClientRect().top < scroll.getBoundingClientRect().bottom && node.getBoundingClientRect().bottom > scroll.getBoundingClientRect().top);
    await wait(() => first.querySelector('img').naturalWidth > 0); await pause(280);
    const source = rectangle(first.querySelector('.photo-image'));
    App.api.source = async (...args) => { await pause(145); return originalSource(...args); };
    first.click();
    await wait(() => document.querySelector('.motion-photo-layer[data-direction="open"]'));
    const flying = document.querySelector('.motion-photo-layer'), early = rectangle(flying);
    assert(Math.abs(early.width - source.width) < source.width * .45, 'Shared photo starts near the clicked card geometry', { source, early });
    assert(getComputedStyle(flying).pointerEvents === 'none' && flying.getAttribute('aria-hidden') === 'true', 'Shared copy is decorative and never intercepts input');
    const copy = flying.querySelector('img'), aspect = copy.naturalWidth / copy.naturalHeight;
    await pause(140);
    const middle = rectangle(flying), picture = rectangle(copy);
    assert(Math.abs(middle.width - early.width) > 2 || Math.abs(middle.y - early.y) > 2, 'Shared photo moves and scales continuously during the transition', { early, middle });
    assert(Math.abs(picture.width / picture.height - aspect) < .01, 'Photo keeps its aspect ratio while cover crop expands to contain', { picture, aspect });
    assert(document.querySelector('.photo-detail').getAnimations().length > 0, 'Detail container scales smoothly alongside the shared image');
    await wait(() => [...document.querySelectorAll('.photo-detail .preview-frame img')].every(image => image.naturalWidth > 0));
    assert(document.querySelector('.photo-detail').getAnimations().some(animation => animation.playState === 'running'), 'JPEG and RAW late-load callbacks run during the actual scaled detail entrance');
    await wait(() => !motion().diagnostics().shared);
    App.api.source = originalSource;
    assert(layers().length === 0 && document.querySelector('#preview-jpeg,#preview-raw').style.visibility !== 'hidden', 'Opening transition releases its image copy and reveals the real preview');
    const frame = document.querySelector('.preview-frame');
    const painted = frame => {
      const image = frame.querySelector('img'), box = image.getBoundingClientRect(), style = getComputedStyle(image);
      const layoutWidth = parseFloat(style.width), layoutHeight = parseFloat(style.height);
      const fit = Math.min(layoutWidth / image.naturalWidth, layoutHeight / image.naturalHeight);
      const width = image.naturalWidth * fit * box.width / layoutWidth, height = image.naturalHeight * fit * box.height / layoutHeight;
      return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
    };
    for (const preview of document.querySelectorAll('.photo-detail .preview-frame')) {
      const content = painted(preview);
      assert(Math.abs(Number(preview.dataset.baseWidth) - content.width) <= 1.5 && Math.abs(Number(preview.dataset.baseHeight) - content.height) <= 1.5,
        'Late-loaded ' + preview.dataset.viewerFormat + ' caches real contain geometry after the entrance settles', { content, base: [preview.dataset.baseWidth, preview.dataset.baseHeight] });
    }
    const frameBox = frame.getBoundingClientRect(), beforeZoom = painted(frame);
    const point = { x: beforeZoom.left + beforeZoom.width / 2 + (beforeZoom.width >= frame.clientWidth - 1 ? beforeZoom.width * .08 : 0),
      y: beforeZoom.top + beforeZoom.height / 2 + (beforeZoom.height >= frame.clientHeight - 1 ? beforeZoom.height * .08 : 0) };
    const normalized = { x: (point.x - beforeZoom.left) / beforeZoom.width, y: (point.y - beforeZoom.top) / beforeZoom.height };
    frame.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, altKey: true, deltaY: -160, clientX: point.x, clientY: point.y }));
    assert(Number(frame.dataset.zoom) > 1, 'Alt or Option wheel zoom remains functional after a shared transition');
    const enlarged = painted(frame);
    assert(Math.abs(enlarged.left + normalized.x * enlarged.width - point.x) <= 1.5 && Math.abs(enlarged.top + normalized.y * enlarged.height - point.y) <= 1.5,
      'Late-load transition preserves the actual photo pixel under an off-centre zoom pointer', { beforeZoom, enlarged, point });
    const dragPoint = { x: frameBox.left + frameBox.width / 2, y: frameBox.top + frameBox.height / 2 };
    for (const [type, delta, buttons] of [['pointerdown', 0, 1], ['pointermove', 10000, 1], ['pointerup', 10000, 0]]) {
      frame.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 995, button: 0, buttons, clientX: dragPoint.x + delta, clientY: dragPoint.y + delta }));
    }
    const moved = painted(frame), frameStyle = getComputedStyle(frame), inside = { left: frameBox.left + parseFloat(frameStyle.borderLeftWidth), top: frameBox.top + parseFloat(frameStyle.borderTopWidth), width: frame.clientWidth, height: frame.clientHeight };
    const boundedAxis = (start, size, frameStart, frameSize) => size >= frameSize - 1 ? start <= frameStart + 1.5 && start + size >= frameStart + frameSize - 1.5 : Math.abs(start + size / 2 - frameStart - frameSize / 2) <= 1.5;
    assert(boundedAxis(moved.left, moved.width, inside.left, inside.width) && boundedAxis(moved.top, moved.height, inside.top, inside.height),
      'Late-loaded zoom pans only within actual photo edges', { moved, inside });
    frame.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    App.closeModal();
    assert(document.querySelector('.motion-photo-layer[data-direction="close"]'), 'Closing a fitted photo reverses smoothly toward the same visible card');
    assert(!document.querySelector('.photo-detail'), 'Reverse animation never delays logical modal closure');
    await wait(() => !motion().diagnostics().shared);
    assert(layers().length === 0, 'Reverse transition clears all image, backdrop, and container layers');
    first.click(); await paint(); await pause(75);
    const openingCopy = document.querySelector('.motion-photo-layer'), openingBox = rectangle(openingCopy), openingModal = rectangle(document.querySelector('.photo-detail'));
    const close = document.querySelector('.photo-detail .modal-close');
    pointer(close, 'pointerdown');
    assert(document.querySelector('.motion-photo-layer') === openingCopy, 'Real close-button pointerdown retains in-flight shared geometry');
    pointer(close, 'pointerup'); close.click();
    const reverseBox = rectangle(document.querySelector('.motion-photo-layer')), reverseShell = rectangle(document.querySelector('.motion-detail-shell'));
    assert(Math.abs(reverseBox.x - openingBox.x) < 4 && Math.abs(reverseBox.width - openingBox.width) < 4,
      'Real pointerdown click closes continuously from the current photo position', { openingBox, reverseBox });
    assert(Math.abs(reverseShell.x - openingModal.x) < 4 && Math.abs(reverseShell.width - openingModal.width) < 4,
      'Mid-entrance close preserves the current detail container scale', { openingModal, reverseShell });
    await wait(() => !motion().diagnostics().shared);
    first.click(); await paint(); await pause(75);
    const escapeCopy = document.querySelector('.motion-photo-layer'), escapeBox = rectangle(escapeCopy);
    document.querySelector('.photo-detail .modal-close').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const escapeReverse = rectangle(document.querySelector('.motion-photo-layer'));
    assert(!document.querySelector('.photo-detail') && Math.abs(escapeReverse.x - escapeBox.x) < 4 && Math.abs(escapeReverse.width - escapeBox.width) < 4,
      'Actual Escape dispatch reverses from the current photo without a final-position jump', { escapeBox, escapeReverse });
    await wait(() => !motion().diagnostics().shared);
    first.click(); await paint(); App.closeModal();
    first.click(); await paint();
    assert(document.querySelectorAll('.motion-photo-layer').length <= 1, 'Rapid open close open keeps at most one shared image');
    const responsive = document.querySelector('.preview-frame');
    responsive.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, altKey: true, deltaY: -200, clientX: responsive.getBoundingClientRect().x + 35, clientY: responsive.getBoundingClientRect().y + 35 }));
    assert(layers().length === 0, 'Detail interaction cancels the temporary shared overlay immediately');
    await wait(() => responsive.querySelector('img').naturalWidth > 0);
    App.closeModal(); await pause(350); first.click(); await paint();
    window.dispatchEvent(new Event('resize'));
    assert(layers().length === 0, 'Window resize safely cancels shared geometry');
    App.closeModal(); await pause(350); first.click(); await paint();
    $('inspect-next').click(); await paint();
    assert(document.querySelectorAll('.photo-detail').length === 1 && document.querySelectorAll('.motion-photo-layer').length <= 1, 'Adjacent navigation replaces the detail without leaving stale layers');
    App.closeModal(); await pause(350);
    assert(layers().length === 0 && !motion().diagnostics().buttons, 'Final cleanup leaves no retained motion layers or button animations');
    return { reduced: false, passed: checks.length, checks };
  } finally {
    App.api.source = originalSource;
    motion().cancelShared(); App.closeModal({ replacement: true });
    App.state.photos = original; App.state.selected = selected; App.state.selectionMode = selectionMode; App.render();
  }
})();
