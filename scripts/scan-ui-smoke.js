(async () => {
  const checks = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const wait = async condition => {
    for (let attempt = 0; attempt < 160; attempt++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Scan UI wait timeout');
  };
  const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
  };
  await wait(() => window.App?.api.isDemo && App.state.photos.length && !App.state.scanning);
  const api = App.api, el = id => document.getElementById(id);
  const originalScan = api.scan, originalThumbnail = api.thumbnail;
  assert(typeof api.qaEmitProgress === 'function', 'Synthetic demo exposes its existing progress channel for scan regression');
  const original = { root: App.state.root, view: App.state.view, visible: App.state.visible, selected: new Set(App.state.selected) };
  const controls = ['search', 'date-from', 'date-to', 'theme-filter', 'tag-filter', 'color-filter', 'sort-order'];
  const values = Object.fromEntries(controls.map(id => [id, el(id).value]));
  const scanReturn = deferred(), heroEntered = deferred(), heroReady = deferred();
  const result = await originalScan(original.root);
  const total = 300;
  const photos = Array.from({ length: total }, (_, index) => {
    const stem = index === total - 1 ? '远方依然可检索' : `扫描回归-${String(index).padStart(3, '0')}`;
    return {
      ...result.photos[0], id: `demo-${index}`, name: `${stem}.JPG`, stem,
      jpegPath: `/合成扫描回归/${stem}.JPG`, path: `/合成扫描回归/${stem}.JPG`,
      rawPath: index >= 120 && index % 3 === 0 ? `/合成扫描回归/${stem}.CR3` : null,
      date: new Date(Date.UTC(2026, 9, 1) - index * 86400000).toISOString().slice(0, 10),
      favorite: index >= 120 && index % 7 === 0,
      theme: index < 120 ? '先显示的记忆' : '完整返回的记忆',
      tags: [index < 120 ? '流式预览' : '完整图库'],
      colorFamily: index < 120 ? 'gray' : 'blue',
    };
  });
  const favorites = photos.filter(photo => photo.favorite).length;
  const rawCount = photos.filter(photo => photo.rawPath).length;
  const fileCount = total + rawCount;
  let earlySent = false, heroWaiting = false, refreshFinished = false, refreshing;
  try {
    el('reset-filters').click();
    el('sort-order').value = 'date-desc';
    App.state.view = 'all';
    api.scan = async root => {
      const base = await originalScan(root);
      api.qaEmitProgress({ kind: 'scan', done: 40, total: fileCount, stream: true, photos: photos.slice(0, 120) });
      earlySent = true;
      await scanReturn.promise;
      return { ...base, photos };
    };
    api.thumbnail = async args => {
      if (args.size === 1200) {
        heroWaiting = true;
        heroEntered.resolve();
        await heroReady.promise;
      }
      return originalThumbnail({ ...args, id: 'demo-0' });
    };
    refreshing = App.refresh(original.root).then(value => { refreshFinished = true; return value; });
    await wait(() => earlySent && App.state.photos.length === 120);
    assert(App.state.scanning && App.state.scanStreaming, 'While scan is pending, incremental previews are accepted');
    assert(el('all-count').textContent === '120' && document.querySelectorAll('.photo-card').length === 120, 'The early 120-photo preview is shown before full scan returns');
    scanReturn.resolve();
    await wait(() => heroWaiting);
    await heroEntered.promise;
    assert(App.state.scanning && !App.state.scanStreaming && !refreshFinished, 'Full scan closes its streaming phase while hero preview is still pending');
    assert(App.state.photos.length === total && App.state.filtered.length === total, 'Full scan result contains all 300 groups beyond the rendered page');
    await new Promise(resolve => setTimeout(() => {
      api.qaEmitProgress({ kind: 'scan', done: fileCount, total: fileCount, stream: true, photos: photos.slice(0, 120) });
      resolve();
    }, 0));
    assert(App.state.photos.length === total && el('all-count').textContent === String(total), 'A late 120-photo progress payload during hero rendering cannot truncate the complete library');
    assert(App.state.photos.filter(photo => photo.favorite).length === favorites && el('favorite-count').textContent === String(favorites), 'Favorites beyond the initial page survive delayed scan progress');
    assert(App.state.photos.filter(photo => photo.rawPath).length === rawCount && el('hero-stats').textContent.includes(`${rawCount} 组 RAW`), 'All 60 RAW pairs beyond the initial page remain indexed and counted');
    el('search').value = '远方依然可检索';
    el('search').dispatchEvent(new Event('input', { bubbles: true }));
    assert(App.state.filtered.length === 1 && App.state.filtered[0].id === 'demo-299' && document.querySelector('.photo-card[data-id="demo-299"]'), 'Searching can find a photo beyond the early 120-item snapshot');
    el('search').value = '';
    el('search').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-view="favorites"]').click();
    assert(App.state.filtered.length === favorites && document.querySelectorAll('.photo-card').length === favorites, 'Favorites view still browses the full returned library while hero awaits');
    document.querySelector('[data-view="all"]').click();
    el('theme-filter').value = '完整返回的记忆';
    el('theme-filter').dispatchEvent(new Event('change', { bubbles: true }));
    assert(App.state.filtered.length === 180, 'Themes populated from the complete result remain searchable after delayed progress');
    el('reset-filters').click();
    heroReady.resolve();
    await refreshing;
    assert(!App.state.scanning && !App.state.scanStreaming && el('progress-section').hidden, 'Scan and streaming phases clear after hero preview completes');
    api.qaEmitProgress({ kind: 'scan', done: fileCount, total: fileCount, stream: true, photos: photos.slice(0, 120) });
    assert(App.state.photos.length === total && App.state.filtered.length === total, 'Late scan progress after refresh completion also preserves the full library');
  } finally {
    scanReturn.resolve();
    heroReady.resolve();
    if (refreshing) await refreshing.catch(() => {});
    api.scan = originalScan;
    api.thumbnail = originalThumbnail;
    App.state.view = original.view;
    for (const id of controls) el(id).value = values[id];
    await App.refresh(original.root);
    App.state.visible = original.visible;
    App.state.selected = original.selected;
    App.render();
  }
  return { passed: checks.length, checks, fixture: { groups: total, favorites, rawPairs: rawCount }, viewport: { width: innerWidth, height: innerHeight } };
})();
