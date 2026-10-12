'use strict';
(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => preference.matches;
  const seen = new Set();
  const entrances = new Map();
  const presses = new Map();
  const springs = new Map();
  let galleryObserver = null, galleryNodes = [], shared = null;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const rect = node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const visible = (box, boundary = { left: 0, top: 0, width: innerWidth, height: innerHeight }) =>
    box.width > 0 && box.height > 0 && box.left < boundary.left + boundary.width &&
    box.left + box.width > boundary.left && box.top < boundary.top + boundary.height &&
    box.top + box.height > boundary.top;
  function remember(id) {
    seen.add(id);
    // Retain a generous bounded history, without holding photo DOM or images.
    if (seen.size > 12000) seen.delete(seen.values().next().value);
  }
  function clearEntrances() {
    galleryObserver?.disconnect(); galleryObserver = null;
    for (const [node, animation] of entrances) {
      animation.cancel(); node.style.removeProperty('will-change');
    }
    entrances.clear();
    for (const node of galleryNodes) node.classList.remove('motion-await');
    galleryNodes = [];
  }
  function gallery(grid, scrollRoot) {
    clearEntrances();
    if (!grid) return;
    galleryNodes = [...grid.querySelectorAll('.photo-card')];
    if (reduced()) {
      galleryNodes.forEach(node => { remember(node.dataset.id); node.dataset.motionEntrance = 'settled'; });
      return;
    }
    galleryObserver = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting && !seen.has(entry.target.dataset.id))
        .sort((a, b) => galleryNodes.indexOf(a.target) - galleryNodes.indexOf(b.target));
      entering.forEach((entry, index) => {
        const node = entry.target;
        galleryObserver?.unobserve(node);
        if (!node.isConnected) return;
        remember(node.dataset.id);
        node.classList.remove('motion-await');
        const delay = Math.min(index * 32, 288);
        node.dataset.motionEntrance = 'entering';
        node.dataset.motionDelay = String(delay);
        node.style.willChange = 'transform, opacity';
        const animation = node.animate([
          { opacity: 0, transform: 'translateY(16px) scale(.985)', offset: 0 },
          { opacity: 1, transform: 'translateY(-2px) scale(1.002)', offset: .68 },
          { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 }
        ], { duration: 540, delay, easing: 'cubic-bezier(.2,.7,.22,1)', fill: 'backwards' });
        animation.id = 'gallery-spring';
        entrances.set(node, animation);
        animation.finished.catch(() => {}).then(() => {
          if (entrances.get(node) !== animation) return;
          entrances.delete(node); node.style.removeProperty('will-change');
          node.dataset.motionEntrance = 'settled';
        });
      });
    }, { root: scrollRoot || null, threshold: .01 });
    galleryNodes.forEach(node => {
      if (seen.has(node.dataset.id)) { node.dataset.motionEntrance = 'settled'; return; }
      node.classList.add('motion-await'); galleryObserver.observe(node);
    });
  }
  const buttonFor = target => target instanceof Element ? target.closest('button') : null;
  function cancelSpring(button) {
    springs.get(button)?.cancel(); springs.delete(button);
  }
  function press(button) {
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const current = getComputedStyle(button).scale;
    cancelSpring(button);
    button.classList.add('motion-button-pressed');
    if (!reduced()) {
      const animation = button.animate([{ scale: current === 'none' ? '1' : current }, { scale: '.96' }],
        { duration: 100, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
      springs.set(button, animation);
    }
    return true;
  }
  function release(button, canceled = false) {
    if (!button) return;
    const current = getComputedStyle(button).scale;
    cancelSpring(button); button.classList.remove('motion-button-pressed');
    if (reduced() || canceled || !button.isConnected || button.disabled) return;
    const animation = button.animate([
      { scale: current === 'none' ? '.96' : current, offset: 0 },
      { scale: '1.018', offset: .42 },
      { scale: '.998', offset: .76 },
      { scale: '1', offset: 1 }
    ], { duration: 350, easing: 'cubic-bezier(.2,.65,.25,1)' });
    springs.set(button, animation);
    animation.finished.catch(() => {}).then(() => { if (springs.get(button) === animation) springs.delete(button); });
  }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const button = buttonFor(event.target);
    if (press(button)) presses.set('p' + event.pointerId, button);
  }, true);
  const endPointer = event => {
    const key = 'p' + event.pointerId, button = presses.get(key);
    presses.delete(key); release(button, event.type === 'pointercancel');
  };
  document.addEventListener('pointerup', endPointer, true);
  document.addEventListener('pointercancel', endPointer, true);
  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.repeat) return;
    const button = buttonFor(event.target);
    if (press(button)) presses.set('k' + event.key, button);
  }, true);
  document.addEventListener('keyup', event => {
    const key = 'k' + event.key, button = presses.get(key);
    presses.delete(key); release(button);
  }, true);
  function cancelButtons() {
    for (const button of presses.values()) button.classList.remove('motion-button-pressed');
    presses.clear();
    for (const [button, animation] of springs) { animation.cancel(); button.classList.remove('motion-button-pressed'); }
    springs.clear();
  }
  window.addEventListener('blur', cancelButtons);
  function cancelShared() {
    if (!shared) return;
    const current = shared; shared = null;
    current.animations.forEach(animation => animation.cancel());
    current.layer?.remove();
    current.extraLayers?.forEach(layer => layer.remove());
    current.image?.style.removeProperty('visibility');
    current.root?.removeAttribute('data-shared-motion');
    current.removeListeners?.();
  }
  function capturePhoto(id) {
    if (reduced()) return null;
    const card = [...document.querySelectorAll('#photo-grid .photo-card')].find(node => node.dataset.id === id);
    const image = card?.querySelector('.photo-image img'), frame = card?.querySelector('.photo-image');
    if (!image?.naturalWidth || !frame || !visible(rect(frame), rect(document.getElementById('main-scroll')))) return null;
    const box = rect(frame), imageBox = rect(image), style = getComputedStyle(frame);
    return { id, src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight,
      box, imageBox, cardBox: rect(card), imageZoom: imageBox.width / box.width,
      radius: parseFloat(style.borderTopLeftRadius) || parseFloat(getComputedStyle(card).borderTopLeftRadius) || 12 };
  }
  function imageFit(box, width, height, fit) {
    const ratio = (fit === 'cover' ? Math.max : Math.min)(box.width / width, box.height / height);
    const w = width * ratio, h = height * ratio;
    return { left: (box.width - w) / 2, top: (box.height - h) / 2, width: w, height: h };
  }
  const frameKey = (box, radius) => ({ left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px', borderRadius: radius + 'px' });
  const imageKey = box => ({ left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
  function fly(from, to, image, root, direction, fromFit = 'cover', toFit = 'contain') {
    const layer = document.createElement('div'); layer.className = 'motion-photo-layer';
    layer.setAttribute('aria-hidden', 'true'); layer.dataset.direction = direction;
    const copy = document.createElement('img'); copy.alt = ''; copy.src = from.src;
    Object.assign(layer.style, frameKey(from.box, from.radius));
    const initialImage = from.currentImageBox || imageFit(from.box, from.width, from.height, fromFit);
    if (fromFit === 'cover' && from.imageZoom && !from.currentImageBox) {
      const zoom = clamp(from.imageZoom, 1, 1.06);
      initialImage.width *= zoom; initialImage.height *= zoom;
      initialImage.left = (from.box.width - initialImage.width) / 2;
      initialImage.top = (from.box.height - initialImage.height) / 2;
    }
    Object.assign(copy.style, imageKey(initialImage));
    layer.append(copy); document.body.append(layer);
    const animationOptions = { duration: direction === 'open' ? 430 : 310, easing: 'cubic-bezier(.22,.75,.22,1)', fill: 'both' };
    const animations = [
      layer.animate([frameKey(from.box, from.radius), frameKey(to.box, to.radius)], animationOptions),
      copy.animate([imageKey(initialImage), imageKey(imageFit(to.box, from.width, from.height, toFit))], animationOptions)
    ];
    if (direction === 'close') animations.push(layer.animate([{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }], animationOptions));
    return { layer, animations, image, root, width: from.width, height: from.height };
  }
  function openPhoto(source, root, id) {
    cancelShared();
    if (reduced() || !source || source.id !== id || !root?.isConnected) return;
    const modal = root.querySelector('.photo-detail'), frame = root.querySelector('.preview-frame'), image = frame?.querySelector('img');
    if (!modal || !frame || !image || modal.classList.contains('is-photo-fullscreen')) return;
    const target = { box: rect(frame), radius: parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 10 };
    if (!visible(target.box)) return;
    image.style.visibility = 'hidden'; root.dataset.sharedMotion = 'open';
    const current = fly(source, target, image, root, 'open');
    const box = rect(modal);
    const startScale = clamp(source.box.width / box.width, .72, .94);
    const dx = (source.box.left + source.box.width / 2 - box.left - box.width / 2) * .12;
    const dy = (source.box.top + source.box.height / 2 - box.top - box.height / 2) * .12;
    current.animations.push(
      root.animate([{ backgroundColor: '#1e342500', backdropFilter: 'blur(0px)' }, { backgroundColor: '#1e342555', backdropFilter: 'blur(12px)' }], { duration: 430, easing: 'ease-out' }),
      modal.animate([{ opacity: .18, transform: `translate(${dx}px,${dy}px) scale(${startScale})` }, { opacity: 1, transform: 'translate(0,0) scale(1)' }], { duration: 430, easing: 'cubic-bezier(.22,.75,.22,1)' })
    );
    const background = document.querySelector('.app-shell');
    if (background) current.animations.push(background.animate([
      { scale: '1' }, { scale: '.995', offset: .5 }, { scale: '1' }
    ], { duration: 430, easing: 'ease-in-out' }));
    const stopInteraction = event => {
      // Closing or navigating needs the in-flight geometry so closePhoto can
      // reverse continuously. Actual preview gestures must reveal the real
      // photo immediately before the viewer handles them.
      if (event.type === 'pointerdown' && (event.target === root || (event.target instanceof Element &&
        event.target.closest('.modal-close,#inspect-prev,#inspect-next')))) return;
      if (event.type === 'keydown' && ['Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      cancelShared();
    };
    root.addEventListener('wheel', stopInteraction, { capture: true, passive: true });
    root.addEventListener('pointerdown', stopInteraction, true); root.addEventListener('keydown', stopInteraction, true);
    const resize = new ResizeObserver(() => {
      if (!frame.isConnected) { cancelShared(); return; }
      // Observer's initial delivery is not a resize. Container transform is only
      // visual: client dimensions stay constant throughout its opening animation.
      if (Math.abs(frame.clientWidth - target.box.width) > 3 || Math.abs(frame.clientHeight - target.box.height) > 3) cancelShared();
    });
    resize.observe(frame);
    current.removeListeners = () => {
      root.removeEventListener('wheel', stopInteraction, true); root.removeEventListener('pointerdown', stopInteraction, true);
      root.removeEventListener('keydown', stopInteraction, true); resize.disconnect();
    };
    shared = current;
    Promise.all(current.animations.map(animation => animation.finished.catch(() => {}))).then(async () => {
      if (shared !== current) return;
      // Hold the cached thumb until the real JPEG/RAW preview can take over. A
      // slow source never blocks controls, close, navigation, or resize.
      if (!image.complete || !image.naturalWidth) await new Promise(resolve => {
        const finish = () => { clearTimeout(timer); image.removeEventListener('load', finish); image.removeEventListener('error', finish); resolve(); };
        const timer = setTimeout(finish, 1200);
        image.addEventListener('load', finish, { once: true }); image.addEventListener('error', finish, { once: true });
        const remove = current.removeListeners;
        current.removeListeners = () => { remove?.(); finish(); };
      });
      if (shared !== current) return;
      cancelShared();
    });
  }
  function closePhoto(root, id, { replacement = false } = {}) {
    const previous = shared;
    const modal = root?.querySelector('.photo-detail');
    const modalStyle = modal && getComputedStyle(modal);
    const shellStart = modal && { box: rect(modal), radius: parseFloat(modalStyle.borderRadius) || 18,
      opacity: Number(modalStyle.opacity), background: modalStyle.background, shadow: modalStyle.boxShadow };
    const backgroundStart = root && getComputedStyle(root).backgroundColor;
    const backdropFilterStart = root && getComputedStyle(root).backdropFilter;
    let flying = null;
    if (!replacement && previous?.layer?.isConnected) {
      const copy = previous.layer.querySelector('img');
      const box = rect(previous.layer), picture = rect(copy);
      flying = { id, src: copy.src, width: previous.width, height: previous.height, box,
        currentImageBox: { left: picture.left - box.left, top: picture.top - box.top, width: picture.width, height: picture.height },
        radius: parseFloat(getComputedStyle(previous.layer).borderRadius) || 10 };
    }
    cancelShared();
    if (replacement || reduced() || !root?.querySelector('.photo-detail') || root.classList.contains('is-photo-fullscreen-backdrop')) return;
    const target = capturePhoto(id);
    const frame = root.querySelector('.preview-frame'), image = frame?.querySelector('img');
    if (!target || !frame || Number(frame.dataset.zoom || 1) !== 1) return;
    const source = flying?.width ? flying : image?.naturalWidth ? { id, src: image.currentSrc || image.src,
      width: image.naturalWidth, height: image.naturalHeight, box: rect(frame), radius: parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 10 } : null;
    if (!source || !visible(source.box)) return;
    const current = fly(source, target, null, null, 'close', 'contain', 'cover');
    const backdrop = document.createElement('div'); backdrop.className = 'motion-backdrop-layer'; backdrop.setAttribute('aria-hidden', 'true');
    backdrop.style.background = backgroundStart; backdrop.style.backdropFilter = backdropFilterStart;
    const shell = document.createElement('div'); shell.className = 'motion-detail-shell'; shell.setAttribute('aria-hidden', 'true');
    Object.assign(shell.style, frameKey(shellStart.box, shellStart.radius));
    shell.style.background = shellStart.background; shell.style.boxShadow = shellStart.shadow;
    document.body.append(backdrop, shell); current.extraLayers = [backdrop, shell];
    current.animations.push(
      backdrop.animate([{ opacity: 1, backdropFilter: backdropFilterStart }, { opacity: 0, backdropFilter: 'blur(0px)' }], { duration: 310, fill: 'both', easing: 'ease-out' }),
      shell.animate([{ ...frameKey(shellStart.box, shellStart.radius), opacity: shellStart.opacity }, { ...frameKey(target.cardBox, target.radius), opacity: 0 }], { duration: 310, fill: 'both', easing: 'cubic-bezier(.22,.75,.22,1)' })
    );
    shared = current;
    Promise.all(current.animations.map(animation => animation.finished.catch(() => {}))).then(() => { if (shared === current) cancelShared(); });
  }
  window.addEventListener('resize', cancelShared, { passive: true });
  preference.addEventListener('change', () => {
    cancelShared(); cancelButtons();
    if (reduced()) {
      galleryNodes.forEach(node => { remember(node.dataset.id); node.dataset.motionEntrance = 'settled'; });
      clearEntrances();
    }
  });
  window.addEventListener('pagehide', () => { clearEntrances(); cancelShared(); cancelButtons(); });
  window.AmbientMotion = { gallery, capturePhoto, openPhoto, closePhoto, cancelShared, reduced,
    diagnostics: () => ({ reduced: reduced(), entrances: entrances.size, seen: seen.size, buttons: springs.size, shared: !!shared }) };
})();
