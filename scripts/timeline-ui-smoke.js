(async () => {
  const checks = [];
  const wait = async test => { for (let i = 0; i < 160; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 40)); } throw new Error('Timeline UI wait timeout'); };
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  await wait(() => window.App?.api.isDemo && window.PhotoTimeline && App.state.photos.length);
  const original = App.state.photos, originalVisible = App.state.visible;
  const el = id => document.getElementById(id);
  const originalSort = el('sort-order').value;
  const originalSearch = el('search').value;
  const originalScale = getComputedStyle(document.documentElement).getPropertyValue('--font-scale');
  try {
    const source = original[0];
    App.state.photos = Array.from({ length: 300 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 9, 1) - index * 86400000).toISOString().slice(0, 10);
      return { ...source, id: `timeline-${index}`, name: `时光-${String(index).padStart(3, '0')}`, stem: `时光-${String(index).padStart(3, '0')}`, date, tags: ['时间轴演示'], favorite: index % 2 === 0 };
    });
    el('sort-order').value = 'date-desc'; el('search').value = ''; App.state.visible = 120; App.render();
    await wait(() => PhotoTimeline.current().total === 300 && el('photo-timeline').getAttribute('aria-valuemax') === '299');
    assert(el('photo-timeline').getAttribute('aria-valuemax') === '299', 'Timeline includes all 300 filtered photos beyond visible page');
    const jumped = await PhotoTimeline.jump(230);
    assert(App.state.visible === 240 && jumped.page === 2, 'Jump at global 230 renders page 2');
    assert(document.querySelector('.photo-card[data-id="timeline-230"]'), 'Requested off-page photo exists after jump');
    assert(PhotoTimeline.current().index === 230 && PhotoTimeline.current().date === App.state.filtered[230].date, 'Handle and date bubble keep requested global position');
    assert(el('main-scroll').scrollTop > 0, 'Jump scrolls requested card into viewport');
    const gridBefore = el('photo-grid').firstElementChild;
    await PhotoTimeline.jump(231);
    assert(el('photo-grid').firstElementChild === gridBefore, 'Same-page jump avoids rebuilding photo grid');
    const rapid = await Promise.all([PhotoTimeline.jump(299), PhotoTimeline.jump(20)]);
    assert(rapid[0] === null && rapid[1]?.index === 20 && PhotoTimeline.current().index === 20 && railIndex() === '20' && App.state.visible === 120, 'Rapid date jumps keep only the newest request');
    await PhotoTimeline.jump(231);
    const rail = el('photo-timeline'), track = rail.querySelector('.photo-timeline-track');
    const capture = rail.setPointerCapture;
    rail.setPointerCapture = () => {};
    try {
      const send = (type, fraction) => {
        const rect = track.getBoundingClientRect();
        rail.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 9, clientX: rect.left, clientY: rect.top + rect.height * fraction }));
      };
      send('pointerdown', 0.12);
      send('pointermove', 0.87);
      assert(App.state.visible === 240 && rail.classList.contains('is-dragging'), 'Pointer drag previews without rebuilding another page');
      assert(rail.querySelector('.photo-timeline-bubble strong').textContent.includes(App.state.filtered[260].date.slice(-2)), 'Pointer drag previews the target date');
      send('pointerup', 0.87);
      await wait(() => PhotoTimeline.current().index === 260 && App.state.visible === 360 && rail.dataset.index === '260');
      assert(document.querySelector('.photo-card[data-id="timeline-260"]') && !rail.classList.contains('is-dragging'), 'Pointer release commits an off-page date jump');
      send('pointerdown', 0.11); send('pointerup', 0.11);
      await wait(() => PhotoTimeline.current().index === 33 && App.state.visible === 120 && rail.dataset.index === '33');
      assert(document.querySelector('.photo-card[data-id="timeline-33"]'), 'Clicking the rail commits the clicked date');
    } finally { rail.setPointerCapture = capture; }
    const pending = PhotoTimeline.jump(230);
    el('search').value = '时光-00'; el('search').dispatchEvent(new Event('input', { bubbles: true }));
    assert(await pending === null, 'A changed filter cancels an outdated pending jump');
    await wait(() => el('photo-timeline').getAttribute('aria-valuemax') === '9');
    el('search').value = ''; el('search').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(() => el('photo-timeline').getAttribute('aria-valuemax') === '299');
    el('photo-timeline').classList.add('is-dragging');
    await new Promise(resolve => setTimeout(resolve, 220));
    assert(Number(getComputedStyle(document.querySelector('.photo-timeline-bubble')).opacity) === 1, 'Date bubble visible during scrubbing');
    assert(parseFloat(getComputedStyle(el('photo-timeline')).width) >= 30, 'Glass timeline expands during scrubbing');
    el('photo-timeline').classList.remove('is-dragging');
    el('search').value = '时光-00'; el('search').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(() => PhotoTimeline.current().total === 10 && el('photo-timeline').getAttribute('aria-valuemax') === '9');
    assert(el('photo-timeline').getAttribute('aria-valuemax') === '9' && PhotoTimeline.current().index < 10, 'Filtering resets timeline bounds and position');
    el('search').value = ''; el('search').dispatchEvent(new Event('input', { bubbles: true }));
    el('sort-order').value = 'name'; el('sort-order').dispatchEvent(new Event('change', { bubbles: true }));
    await PhotoTimeline.jump(299);
    assert(document.querySelector('.photo-timeline-bubble span').textContent.includes('当前排序位置'), 'Non-date sorting is labeled as current order');
    App.applyFontScale(1.5); PhotoTimeline.refresh();
    assert(document.documentElement.scrollWidth <= innerWidth + 1 && el('main-scroll').scrollWidth <= el('main-scroll').clientWidth + 1, '150 percent font and timeline have no horizontal overflow');
    App.state.photos = [App.state.photos[0]]; App.state.visible = 120; App.render();
    await wait(() => PhotoTimeline.current().total === 1 && el('photo-timeline').getAttribute('aria-valuemax') === '0');
    assert(el('photo-timeline').getAttribute('aria-valuemax') === '0', 'Single-photo timeline remains valid');
    App.state.photos = []; App.render();
    await wait(() => PhotoTimeline.current().total === 0 && el('photo-timeline').hidden);
    assert(el('photo-timeline').hidden, 'Empty timeline is hidden');
  } finally {
    App.state.photos = original; App.state.visible = originalVisible; el('sort-order').value = originalSort; el('search').value = originalSearch;
    document.documentElement.style.setProperty('--font-scale', originalScale); App.render(); PhotoTimeline.refresh();
  }
  return { passed: checks.length, checks, viewport: { width: innerWidth, height: innerHeight } };
  function railIndex() { return el('photo-timeline').dataset.index; }
})();
