'use strict';
(() => {
  const MAX_ZOOM = 16;
  function mount(root) {
    const cleanups = [];
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
      status.setAttribute('aria-label', `${label} 相对适合窗口的缩放比例`);
      const reset = document.createElement('button');
      reset.className = 'photo-viewer-reset';
      reset.type = 'button';
      reset.dataset.viewerReset = format;
      reset.textContent = '适合窗口';
      reset.setAttribute('aria-label', `${label} 重置为适合窗口`);
      const hint = document.createElement('span');
      hint.className = 'photo-viewer-hint';
      hint.id = `zoom-hint-${format}`;
      hint.textContent = 'Alt / Option + 滚轮缩放 · 放大后拖动';
      controls.append(status, reset, hint);
      frame.after(controls);
      frame.classList.add('photo-viewer-frame');
      frame.tabIndex = 0;
      frame.setAttribute('role', 'group');
      frame.setAttribute('aria-label', `${label} 图片预览`);
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
          ? (format === 'raw' ? '内嵌预览 · 放大细节' : '放大细节 · 拖动查看') : fitLabel;
        status.title = '相对整张照片适合窗口的比例';
        reset.title = zoom > 1 ? '恢复完整照片，也可双击预览' : '正在完整显示照片';
      };
      const fit = () => {
        endDrag();
        zoom = 1; panX = 0; panY = 0;
        render();
      };
      const measure = () => {
        if (disposed) return;
        const box = frame.getBoundingClientRect(), style = getComputedStyle(frame);
        borderLeft = parseFloat(style.borderLeftWidth) || 0;
        borderTop = parseFloat(style.borderTopWidth) || 0;
        const nextWidth = box.width - borderLeft - (parseFloat(style.borderRightWidth) || 0);
        const nextHeight = box.height - borderTop - (parseFloat(style.borderBottomWidth) || 0);
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
      const resize = new ResizeObserver(measure);
      resize.observe(frame);
      measure();
      cleanups.push(() => {
        disposed = true;
        endDrag();
        resize.disconnect();
        listeners.forEach(remove => remove());
        controls.remove();
      });
    });
    return () => cleanups.splice(0).forEach(cleanup => cleanup());
  }
  window.PhotoViewer = { mount, maxZoom: MAX_ZOOM };
})();
