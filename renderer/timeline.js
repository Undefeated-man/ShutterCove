'use strict';
(() => {
  const app = window.App;
  const scroll = document.getElementById('main-scroll');
  const grid = document.getElementById('photo-grid');
  const panel = document.querySelector('.main-panel');
  if (!app || !scroll || !grid || !panel) return;
  const PAGE = 120;
  const rail = document.createElement('div');
  rail.id = 'photo-timeline';
  rail.className = 'photo-timeline';
  rail.tabIndex = 0;
  rail.setAttribute('role', 'slider');
  rail.setAttribute('aria-label', '照片时间轴，拖动快速跳转全部筛选照片');
  rail.setAttribute('aria-orientation', 'vertical');
  rail.innerHTML = '<div class="photo-timeline-track"><span class="photo-timeline-tick first"></span><span class="photo-timeline-tick last"></span><div class="photo-timeline-handle"></div></div><span class="photo-timeline-end first"></span><span class="photo-timeline-end last"></span><div class="photo-timeline-bubble"><strong></strong><span></span></div>';
  panel.append(rail);
  const track = rail.querySelector('.photo-timeline-track');
  const handle = rail.querySelector('.photo-timeline-handle');
  const bubble = rail.querySelector('.photo-timeline-bubble');
  const first = rail.querySelector('.photo-timeline-end.first');
  const last = rail.querySelector('.photo-timeline-end.last');
  let currentIndex = 0, previewIndex = null, dragging = false, jumping = false, frame = 0, pulseTimer, jumpGeneration = 0;
  let pinnedIndex = null, pinnedTop = 0, previousSignature = '';
  const photos = () => app.state.filtered || [];
  const clamp = index => Math.max(0, Math.min(Math.max(0, photos().length - 1), Math.round(Number(index) || 0)));
  const pageStart = () => Math.max(0, (Number(app.state.visible) || PAGE) - PAGE);
  const shortDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.slice(0, 7).replace('-', ' / ') : '日期未知';
  const fullDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1 年 $2 月 $3 日') : '日期未知';
  const chronological = () => app.state.view !== 'similar' && (document.getElementById('sort-order')?.value || 'date-desc').startsWith('date-');

  function display(index, preview = false) {
    const list = photos();
    if (!list.length) return;
    index = clamp(index);
    const fraction = list.length > 1 ? index / (list.length - 1) : 0;
    const trackHeight = track.clientHeight;
    const y = track.offsetTop + fraction * trackHeight;
    if (!preview || dragging) handle.style.transform = `translateY(${fraction * Math.max(0, trackHeight - 28)}px)`;
    bubble.style.top = `${Math.max(30, Math.min(rail.clientHeight - 30, y))}px`;
    bubble.querySelector('strong').textContent = fullDate(list[index].date);
    bubble.querySelector('span').textContent = `${(index + 1).toLocaleString()} / ${list.length.toLocaleString()} 张${chronological() ? '' : ' · 当前排序位置'}`;
    rail.setAttribute('aria-valuemin', '0');
    rail.setAttribute('aria-valuemax', String(Math.max(0, list.length - 1)));
    rail.setAttribute('aria-valuenow', String(preview ? currentIndex : index));
    rail.setAttribute('aria-valuetext', `${fullDate(list[index].date)}，第 ${index + 1} 张，共 ${list.length} 张`);
    rail.dataset.index = String(preview ? currentIndex : index);
    rail.dataset.previewIndex = String(index);
  }

  function scrollPosition() {
    if (dragging || jumping || !photos().length) return;
    if (pinnedIndex != null && Math.abs(scroll.scrollTop - pinnedTop) < 2) { currentIndex = clamp(pinnedIndex); display(currentIndex); return; }
    pinnedIndex = null;
    const top = scroll.getBoundingClientRect().top + (app.galleryInset?.() ?? 18);
    const cards = [...grid.querySelectorAll('.photo-card')];
    const visible = cards.find(card => card.getBoundingClientRect().bottom > top) || cards.at(-1);
    const local = visible ? cards.indexOf(visible) : 0;
    currentIndex = clamp(pageStart() + Math.max(0, local));
    display(currentIndex);
  }

  function refresh() {
    frame = 0;
    const list = photos();
    rail.hidden = list.length === 0;
    panel.classList.toggle('photo-timeline-enabled', list.length > 0);
    rail.setAttribute('aria-disabled', String(list.length <= 1));
    rail.style.top = `${scroll.getBoundingClientRect().top - panel.getBoundingClientRect().top + (app.galleryInset?.() ?? 16)}px`;
    if (!list.length) { currentIndex = 0; pinnedIndex = null; return; }
    first.textContent = shortDate(list[0].date);
    last.textContent = shortDate(list.at(-1).date);
    first.title = `当前排列的第一张 · ${fullDate(list[0].date)}`;
    last.title = `当前排列的最后一张 · ${fullDate(list.at(-1).date)}`;
    rail.title = chronological() ? '拖动时间轴，快速跳到一段回忆' : '按当前排列跳转，气泡显示对应照片日期';
    const signature = `${list.length}:${list[0]?.id}:${list.at(-1)?.id}:${app.state.view}:${document.getElementById('sort-order')?.value}`;
    if (signature !== previousSignature) { previousSignature = signature; pinnedIndex = null; previewIndex = null; }
    if (!dragging && !jumping) scrollPosition();
    else display(previewIndex ?? currentIndex, dragging);
  }

  function scheduleRefresh() { if (!frame) frame = requestAnimationFrame(refresh); }
  function pulse() { rail.classList.add('is-scrolling'); clearTimeout(pulseTimer); pulseTimer = setTimeout(() => rail.classList.remove('is-scrolling'), 850); }
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  async function jump(index) {
    if (!photos().length) return null;
    const generation = ++jumpGeneration;
    index = clamp(index);
    const photo = photos()[index];
    const page = (Math.floor(index / PAGE) + 1) * PAGE;
    const order = document.getElementById('sort-order')?.value, view = app.state.view, total = photos().length;
    const stillCurrent = () => generation === jumpGeneration && app.state.visible === page && photos().length === total && photos()[index]?.id === photo.id && document.getElementById('sort-order')?.value === order && app.state.view === view;
    const cancel = () => { if (generation === jumpGeneration) { jumping = false; pinnedIndex = null; previewIndex = null; scheduleRefresh(); } return null; };
    jumping = true;
    pinnedIndex = index;
    currentIndex = index;
    if (app.state.visible !== page) { app.state.visible = page; app.render(); }
    await nextFrame();
    if (!stillCurrent()) return cancel();
    const card = [...grid.querySelectorAll('.photo-card')].find(node => node.dataset.id === photo.id);
    if (card) {
      const top = scroll.scrollTop + card.getBoundingClientRect().top - scroll.getBoundingClientRect().top - (app.galleryInset?.() ?? 18);
      scroll.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
    pinnedTop = scroll.scrollTop;
    await nextFrame();
    if (!stillCurrent()) return cancel();
    jumping = false;
    previewIndex = null;
    display(index);
    pulse();
    return { index, id: photo.id, date: photo.date, page: page / PAGE };
  }

  function indexAt(event) {
    const rect = track.getBoundingClientRect();
    return clamp((event.clientY - rect.top) / Math.max(1, rect.height) * Math.max(0, photos().length - 1));
  }
  rail.addEventListener('pointerdown', event => {
    if (event.button !== 0 || photos().length <= 1) return;
    event.preventDefault();
    jumpGeneration++;
    jumping = false;
    dragging = true;
    rail.classList.add('is-dragging');
    try { rail.setPointerCapture(event.pointerId); } catch { /* Synthetic events have no active native pointer. */ }
    previewIndex = indexAt(event);
    display(previewIndex, true);
  });
  rail.addEventListener('pointermove', event => {
    if (!photos().length) return;
    previewIndex = indexAt(event);
    display(previewIndex, true);
  });
  rail.addEventListener('pointerup', event => {
    if (!dragging) return;
    const target = indexAt(event);
    dragging = false;
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    jump(target);
  });
  const stopPreview = () => { dragging = false; previewIndex = null; rail.classList.remove('is-dragging'); display(currentIndex); };
  rail.addEventListener('pointercancel', stopPreview);
  rail.addEventListener('lostpointercapture', () => { if (dragging) stopPreview(); });
  rail.addEventListener('pointerleave', () => { if (!dragging) { previewIndex = null; display(currentIndex); } });
  rail.addEventListener('keydown', event => {
    let target;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = photos().length - 1;
    else if (event.key === 'ArrowUp') target = currentIndex - 1;
    else if (event.key === 'ArrowDown') target = currentIndex + 1;
    else if (event.key === 'PageUp') target = currentIndex - PAGE;
    else if (event.key === 'PageDown') target = currentIndex + PAGE;
    else return;
    event.preventDefault(); jump(target);
  });
  scroll.addEventListener('scroll', () => { pulse(); scheduleRefresh(); }, { passive: true });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  new MutationObserver(scheduleRefresh).observe(grid, { childList: true });
  new ResizeObserver(scheduleRefresh).observe(scroll);
  window.PhotoTimeline = {
    refresh,
    jump,
    current: () => ({ index: currentIndex, previewIndex, date: photos()[currentIndex]?.date || null, id: photos()[currentIndex]?.id || null, total: photos().length, page: Math.floor(currentIndex / PAGE) + 1 }),
  };
  refresh();
})();
