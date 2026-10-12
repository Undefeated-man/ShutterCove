'use strict';
(() => {
  const MAX_ZOOM = 16;
  const t = (text, values = {}) => window.I18n?.t(text, values) ?? text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '{' + key + '}'));
  let pendingFullscreen = null;
  let windowTransition = Promise.resolve();
  function mountFullscreen(root) {
    const modal = root.querySelector('.photo-detail');
    if (!modal) return { register() {}, dispose() {} };
    const api = window.App?.api || window.timeMachine;
    const previews = [...root.querySelectorAll('.preview-block')];
    const formats = previews.map(block => block.querySelector('img')?.id === 'preview-raw' ? 'raw' : 'jpeg');
    if (!formats.length) return { register() {}, dispose() {} };
    const footerHint = modal.querySelector('.keyboard-hint');
    if (footerHint) footerHint.textContent = t('← → 切换照片 · F 全屏 · Esc 关闭');
    const buttons = new Map();
    let selected = formats[0], session = null, disposed = false, handoff = false;
    const toolbar = document.createElement('div');
    toolbar.className = 'photo-fullscreen-toolbar';
    toolbar.hidden = true;
    const title = document.createElement('div');
    title.className = 'photo-fullscreen-title';
    const name = document.createElement('strong');
    name.textContent = modal.querySelector('.modal-header h3')?.textContent || t('照片');
    name.setAttribute('data-i18n-ignore', '');
    const subtitle = document.createElement('span');
    subtitle.textContent = t('← → 切换照片 · F / Esc 返回详情');
    title.append(name, subtitle);
    const tabs = document.createElement('div');
    tabs.className = 'photo-fullscreen-formats';
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', t('全屏预览格式'));
    const formatButtons = new Map();
    for (const format of formats) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-fullscreen-format';
      button.dataset.fullscreenFormat = format;
      button.textContent = format === 'raw' ? t('CR3 预览') : 'JPEG';
      button.addEventListener('click', () => { selected = format; render(true); focusFrame(); });
      formatButtons.set(format, button);
      tabs.append(button);
    }
    const actions = document.createElement('div');
    actions.className = 'photo-fullscreen-actions';
    const previous = document.createElement('button');
    const next = document.createElement('button');
    const exit = document.createElement('button');
    for (const button of [previous, next, exit]) { button.type = 'button'; button.className = 'photo-fullscreen-action'; }
    previous.dataset.fullscreenNavigate = '-1'; previous.textContent = '←'; previous.setAttribute('aria-label', t('全屏上一张照片'));
    next.dataset.fullscreenNavigate = '1'; next.textContent = '→'; next.setAttribute('aria-label', t('全屏下一张照片'));
    exit.dataset.fullscreenExit = ''; exit.textContent = t('退出全屏');
    previous.addEventListener('click', () => navigate(-1));
    next.addEventListener('click', () => navigate(1));
    exit.addEventListener('click', () => leave());
    actions.append(previous, next, exit);
    toolbar.append(title, tabs, actions);
    modal.prepend(toolbar);
    const isActive = () => !!session?.active;
    const focusFrame = () => {
      const block = previews[formats.indexOf(selected)];
      block?.querySelector('.preview-frame')?.focus({ preventScroll: true });
    };
    const render = focus => {
      const active = isActive();
      if (footerHint) footerHint.textContent = t('← → 切换照片 · F 全屏 · Esc 关闭');
      subtitle.textContent = t('← → 切换照片 · F / Esc 返回详情');
      tabs.setAttribute('aria-label', t('全屏预览格式'));
      previous.setAttribute('aria-label', t('全屏上一张照片'));
      next.setAttribute('aria-label', t('全屏下一张照片'));
      exit.textContent = t('退出全屏');
      for (const [format, button] of formatButtons) button.textContent = format === 'raw' ? t('CR3 预览') : 'JPEG';
      for (const [format, button] of buttons) { button.textContent = t('⛶ 全屏'); button.title = t('全屏查看这张照片 · F'); button.setAttribute('aria-label', t('{format} 全屏查看', { format: format === 'raw' ? t('CR3 内嵌预览') : 'JPEG' })); }
      modal.classList.toggle('is-photo-fullscreen', active);
      root.classList.toggle('is-photo-fullscreen-backdrop', active);
      modal.dataset.photoFullscreen = String(active);
      toolbar.hidden = !active;
      previews.forEach((block, index) => block.classList.toggle('is-fullscreen-active', active && formats[index] === selected));
      for (const [format, button] of formatButtons) button.setAttribute('aria-pressed', String(format === selected));
      for (const button of buttons.values()) {
        button.disabled = !!session?.pending;
        button.setAttribute('aria-pressed', String(active));
      }
      if (focus) queueMicrotask(() => { if (!disposed && isActive()) focusFrame(); });
    };
    const transition = operation => {
      const result = windowTransition.catch(() => {}).then(operation);
      windowTransition = result.catch(() => {});
      return result;
    };
    const restoreWindow = (current, restore = true) => transition(async () => {
      await current.ready.catch(() => {});
      if (restore && current.hasSnapshot && typeof api?.setPhotoFullscreen === 'function') {
        await api.setPhotoFullscreen({ enabled: current.before });
      }
    }).catch(error => { if (!disposed) window.App?.toast(error.message || t('窗口恢复失败'), true); });
    function leave(restore = true) {
      const current = session;
      if (!current) return;
      current.active = false;
      session = null;
      render(false);
      if (!disposed) buttons.get(selected)?.focus({ preventScroll: true });
      return restoreWindow(current, restore);
    }
    function enter(format) {
      if (disposed || isActive()) return;
      selected = formats.includes(format) ? format : formats[0];
      const current = { active: true, pending: true, hasSnapshot: false, before: false, ready: null };
      session = current;
      render(true);
      current.ready = transition(async () => {
        // Demo and browser previews cover their own window; packaged builds use
        // a narrow IPC bridge to the actual Electron window, never DOM permission.
        if (typeof api?.getPhotoFullscreen === 'function' && typeof api?.setPhotoFullscreen === 'function') {
          const initial = await api.getPhotoFullscreen();
          current.before = initial?.enabled === true;
          current.hasSnapshot = true;
          if (current.active && !current.before) await api.setPhotoFullscreen({ enabled: true });
        }
      });
      current.ready.then(() => {
        current.pending = false;
        if (!disposed && session === current && current.active) render(true);
      }).catch(error => {
        current.pending = false;
        if (!disposed && session === current) { leave(); window.App?.toast(error.message || t('无法进入全屏'), true); }
      });
    }
    function navigate(direction) {
      if (!isActive() || session.pending) return;
      const current = session;
      current.format = selected;
      handoff = true;
      root.querySelector(direction < 0 ? '#inspect-prev' : '#inspect-next')?.click();
      // A missing adjacent photo leaves this dialog mounted.
      if (!disposed) handoff = false;
    }
    const keys = event => {
      if (disposed || !root.isConnected) return;
      const typing = event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);
      if (event.key === 'Escape' && isActive()) {
        event.preventDefault(); event.stopImmediatePropagation(); leave(); return;
      }
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault(); event.stopImmediatePropagation(); isActive() ? leave() : enter(selected); return;
      }
      if (!typing && isActive() && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation(); navigate(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', keys, true);
    const removeLanguage = window.I18n?.onChange?.(() => { if (!disposed) render(false); });
    const removeWindowListener = api?.onPhotoFullscreen?.(state => {
      // The OS can leave fullscreen through its own controls. Do not reopen it
      // while restoring the detail dialog, or close the photo behind it.
      if (state?.enabled === false && isActive() && !session.pending) leave(false);
    });
    if (pendingFullscreen) {
      session = pendingFullscreen;
      pendingFullscreen = null;
      selected = formats.includes(session.format) ? session.format : formats[0];
      render(true);
    } else render(false);
    return {
      register(format, controls, frame) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'photo-viewer-fullscreen';
        button.dataset.viewerFullscreen = format;
        button.textContent = t('⛶ 全屏');
        button.title = t('全屏查看这张照片 · F');
        button.setAttribute('aria-label', t('{format} 全屏查看', { format: format === 'raw' ? t('CR3 内嵌预览') : 'JPEG' }));
        button.addEventListener('click', () => enter(format));
        frame.addEventListener('focus', () => { if (!isActive()) selected = format; });
        controls.insertBefore(button, controls.querySelector('.photo-viewer-hint'));
        buttons.set(format, button);
        render(false);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        window.removeEventListener('keydown', keys, true);
        removeLanguage?.();
        removeWindowListener?.();
        if (isActive() && handoff) {
          const current = session;
          pendingFullscreen = current;
          queueMicrotask(() => { if (pendingFullscreen === current) { pendingFullscreen = null; current.active = false; restoreWindow(current); } });
          session = null;
        } else leave();
        toolbar.remove();
      }
    };
  }
  function mount(root) {
    const cleanups = [];
    const fullscreen = mountFullscreen(root);
    cleanups.push(() => fullscreen.dispose());
    const avoidAltMenu = event => { if (event.key === 'Alt') event.preventDefault(); };
    root.addEventListener('keydown', avoidAltMenu, true);
    root.addEventListener('keyup', avoidAltMenu, true);
    cleanups.push(() => {
      root.removeEventListener('keydown', avoidAltMenu, true);
      root.removeEventListener('keyup', avoidAltMenu, true);
    });
    root.querySelectorAll('.preview-frame').forEach(frame => {
      const image = frame.querySelector('img');
      if (!image) return;
      const format = image.id === 'preview-raw' ? 'raw' : 'jpeg';
      const label = format === 'raw' ? 'CR3 内嵌预览' : 'JPEG';
      const previewLabel = frame.previousElementSibling?.querySelector('span:last-child');
      const fitLabel = previewLabel?.textContent;
      const controls = document.createElement('div');
      controls.className = 'photo-viewer-controls';
      const status = document.createElement('output');
      status.className = 'photo-viewer-zoom';
      status.id = `zoom-${format}`;
      status.setAttribute('aria-label', t('{format} 相对适合窗口的缩放比例', { format: t(label) }));
      const reset = document.createElement('button');
      reset.className = 'photo-viewer-reset';
      reset.type = 'button';
      reset.dataset.viewerReset = format;
      reset.textContent = t('适合窗口');
      reset.setAttribute('aria-label', t('{format} 重置为适合窗口', { format: t(label) }));
      const hint = document.createElement('span');
      hint.className = 'photo-viewer-hint';
      hint.id = `zoom-hint-${format}`;
      hint.textContent = t('Alt / Option + 滚轮缩放 · 放大后拖动');
      controls.append(status, reset, hint);
      fullscreen.register(format, controls, frame);
      frame.after(controls);
      frame.classList.add('photo-viewer-frame');
      frame.tabIndex = 0;
      frame.setAttribute('role', 'group');
      frame.setAttribute('aria-label', t('{format} 图片预览', { format: t(label) }));
      frame.setAttribute('aria-describedby', hint.id);
      frame.dataset.viewerFormat = format;
      frame.dataset.maxZoom = String(MAX_ZOOM);
      image.draggable = false;
      let zoom = 1, panX = 0, panY = 0, width = 0, height = 0;
      let baseWidth = 0, baseHeight = 0, borderLeft = 0, borderTop = 0, drag = null, disposed = false;
      const listeners = [];
      const listen = (target, name, fn, options) => {
        target.addEventListener(name, fn, options);
        listeners.push(() => target.removeEventListener(name, fn, options));
      };
      const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
      const endDrag = () => {
        if (drag && frame.hasPointerCapture?.(drag.id)) frame.releasePointerCapture(drag.id);
        drag = null;
        frame.classList.remove('is-panning');
      };
      const render = () => {
        status.setAttribute('aria-label', t('{format} 相对适合窗口的缩放比例', { format: t(label) }));
        reset.setAttribute('aria-label', t('{format} 重置为适合窗口', { format: t(label) }));
        frame.setAttribute('aria-label', t('{format} 图片预览', { format: t(label) }));
        reset.textContent = t('适合窗口');
        hint.textContent = t('Alt / Option + 滚轮缩放 · 放大后拖动');
        const limitX = Math.max(0, (baseWidth * zoom - width) / 2);
        const limitY = Math.max(0, (baseHeight * zoom - height) / 2);
        panX = clamp(panX, limitX);
        panY = clamp(panY, limitY);
        image.style.transformOrigin = '50% 50%';
        image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        frame.dataset.zoom = String(zoom);
        frame.dataset.panX = String(panX);
        frame.dataset.panY = String(panY);
        frame.dataset.baseWidth = String(baseWidth);
        frame.dataset.baseHeight = String(baseHeight);
        frame.classList.toggle('is-zoomed', zoom > 1);
        frame.style.touchAction = zoom > 1 ? 'none' : 'auto';
        status.textContent = `${Math.round(zoom * 100)}%`;
        if (previewLabel) previewLabel.textContent = zoom > 1
          ? (format === 'raw' ? t('内嵌预览 · 放大细节') : t('放大细节 · 拖动查看')) : fitLabel ? t(fitLabel) : fitLabel;
        status.title = t('相对整张照片适合窗口的比例');
        reset.title = zoom > 1 ? t('恢复完整照片，也可双击预览') : t('正在完整显示照片');
      };
      const fit = () => {
        endDrag();
        zoom = 1; panX = 0; panY = 0;
        render();
      };
      const measure = () => {
        if (disposed) return;
        const style = getComputedStyle(frame);
        borderLeft = parseFloat(style.borderLeftWidth) || 0;
        borderTop = parseFloat(style.borderTopWidth) || 0;
        // Detail entrances transform the whole modal. Their visual rectangle
        // must not change the photo's layout dimensions or zoom bounds. Computed
        // dimensions also retain fractions that clientWidth/clientHeight round.
        const horizontalBorder = borderLeft + (parseFloat(style.borderRightWidth) || 0);
        const verticalBorder = borderTop + (parseFloat(style.borderBottomWidth) || 0);
        const nextWidth = parseFloat(style.width) - (style.boxSizing === 'border-box' ? horizontalBorder : 0);
        const nextHeight = parseFloat(style.height) - (style.boxSizing === 'border-box' ? verticalBorder : 0);
        const changed = Math.abs(nextWidth - width) > .5 || Math.abs(nextHeight - height) > .5;
        width = nextWidth; height = nextHeight;
        const scale = image.naturalWidth && image.naturalHeight
          ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : 0;
        baseWidth = image.naturalWidth * scale;
        baseHeight = image.naturalHeight * scale;
        if (changed) fit(); else render();
      };
      const zoomAt = (nextZoom, clientX, clientY) => {
        if (!baseWidth || !baseHeight) return;
        nextZoom = Math.max(1, Math.min(MAX_ZOOM, nextZoom));
        if (nextZoom === zoom) return;
        if (nextZoom === 1) { fit(); return; }
        const box = frame.getBoundingClientRect();
        let x = clientX - box.left - borderLeft - width / 2;
        let y = clientY - box.top - borderTop - height / 2;
        // Letterbox space anchors to the nearest photo edge, never to empty pixels.
        x = Math.max(panX - baseWidth * zoom / 2, Math.min(panX + baseWidth * zoom / 2, x));
        y = Math.max(panY - baseHeight * zoom / 2, Math.min(panY + baseHeight * zoom / 2, y));
        const ratio = nextZoom / zoom;
        panX = x - (x - panX) * ratio;
        panY = y - (y - panY) * ratio;
        zoom = nextZoom;
        render();
      };
      listen(image, 'load', () => { measure(); fit(); });
      listen(frame, 'wheel', event => {
        if (!event.altKey || disposed) return;
        event.preventDefault();
        event.stopPropagation();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
        const delta = Math.max(-400, Math.min(400, event.deltaY * unit));
        zoomAt(zoom * Math.exp(-delta * .0025), event.clientX, event.clientY);
      }, { passive: false });
      listen(frame, 'pointerdown', event => {
        if (zoom <= 1 || event.button !== 0 || disposed) return;
        event.preventDefault();
        frame.focus({ preventScroll: true });
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
        try { frame.setPointerCapture?.(event.pointerId); } catch (_) { /* Synthetic or ended pointers have no native capture. */ }
        frame.classList.add('is-panning');
      });
      listen(frame, 'pointermove', event => {
        if (!drag || drag.id !== event.pointerId || disposed) return;
        panX = drag.panX + event.clientX - drag.x;
        panY = drag.panY + event.clientY - drag.y;
        render();
      });
      listen(frame, 'pointerup', endDrag);
      listen(frame, 'pointercancel', endDrag);
      listen(frame, 'lostpointercapture', () => { drag = null; frame.classList.remove('is-panning'); });
      listen(frame, 'dblclick', fit);
      listen(reset, 'click', fit);
      listen(frame, 'keydown', event => {
        if (event.key === 'Alt') { event.preventDefault(); return; }
        if (!['+', '=', '-', '0'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === '0') fit();
        else {
          const box = frame.getBoundingClientRect();
          zoomAt(zoom * (event.key === '-' ? 1 / 1.25 : 1.25), box.left + box.width / 2, box.top + box.height / 2);
        }
      });
      const removeLanguage = window.I18n?.onChange?.(() => { if (!disposed) render(); });
      const resize = new ResizeObserver(measure);
      resize.observe(frame);
      measure();
      cleanups.push(() => {
        disposed = true;
        endDrag();
        resize.disconnect();
        removeLanguage?.();
        listeners.forEach(remove => remove());
        controls.remove();
      });
    });
    return () => cleanups.splice(0).forEach(cleanup => cleanup());
  }
  window.PhotoViewer = { mount, maxZoom: MAX_ZOOM };
})();
