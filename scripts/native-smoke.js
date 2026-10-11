(async () => {
  const wait = async condition => {
    for (let i = 0; i < 1800; i++) { if (condition()) return; await new Promise(r => setTimeout(r, 50)); }
    throw new Error('Native photo load timed out');
  };
  const checks = [];
  const assert = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  await wait(() => App.state.photos.length > 0 && !App.state.scanning);
  assert(!App.api.isDemo, 'Production IPC bridge');
  const photo = App.state.photos.find(p => p.jpegPath);
  const url = await timeMachine.source({ id: photo.id, format: 'jpeg' });
  assert(url.startsWith('memory-photo://'), 'Restricted photo protocol');
  const image = await new Promise((resolve, reject) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = reject; i.src = url;
  });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 100, 80);
  assert(ctx.getImageData(20, 20, 1, 1).data.length === 4, 'Native original can be read by edit canvas without CORS taint');
  const saved = await timeMachine.saveImage({ dataUrl: canvas.toDataURL('image/jpeg', .9), suggestedName: 'synthetic-native-export.jpg' });
  assert(!saved.canceled && saved.path.endsWith('synthetic-native-export.jpg'), 'Production JPEG encode and atomic disk save');
  const result = await timeMachine.analyzeColors({ ids: [photo.id] });
  assert(result.photos[0].colorFamily !== 'unknown', 'Native thumbnail color analysis');
  const settings = await timeMachine.getSettings();
  assert(settings.fontScale === 1.2, 'Larger default font scale');
  const adjusted = await timeMachine.saveSettings({ fontScale: 1.4 });
  assert(adjusted.fontScale === 1.4 && (await timeMachine.getSettings()).fontScale === 1.4, 'Font setting saved through production IPC');
  const clamped = await timeMachine.saveSettings({ fontScale: 2 });
  assert(clamped.fontScale === 1.5, 'Font scale respects the supported range');
  let rejected = false;
  try { await timeMachine.saveSettings({ fontScale: NaN }); } catch { rejected = true; }
  assert(rejected, 'Invalid font scale is rejected');
  await timeMachine.saveSettings({ fontScale: 1.4 });
  const similar = await timeMachine.similar({ referenceId: photo.id, directory: settings.libraryRoot, grid: 8, limit: 10 });
  assert(similar.photos.length > 0, 'Native on-demand cosine search');
  const jpegPhotos = App.state.photos.filter(item => item.jpegPath);
  const ids = jpegPhotos.map(item => item.id);
  const destination = saved.path.replace(/[\\/][^\\/]+$/, '');
  const copies = await timeMachine.copySelected({ ids, directory: destination });
  assert(!copies.cancelled && !copies.errors.length && copies.copiedCount === ids.length && !copies.skippedCount, 'Production copy defaults to JPEG and reports every selected photo');
  assert(copies.copied.every(item => item.format === 'jpeg' && item.path.replace(/[\\/][^\\/]+$/, '') === destination && ids.includes(item.id)), 'Production copy collects cross-directory JPEGs into a flat destination');
  const repeated = await timeMachine.copySelected({ ids, directory: destination, includeRaw: false });
  assert(!repeated.cancelled && !repeated.errors.length && repeated.copiedCount === ids.length, 'Repeated production copy completes without overwriting existing files');
  const paired = jpegPhotos.filter(item => item.rawPath);
  const withRaw = await timeMachine.copySelected({ ids, directory: destination, includeRaw: true });
  assert(paired.length > 0 && !withRaw.cancelled && !withRaw.errors.length && withRaw.copiedCount === ids.length + paired.length && withRaw.copied.filter(item => item.format === 'raw').length === paired.length, 'Optional CR3 copying uses the production bridge and transfers each synthetic pair');
  const stem = file => file.replace(/\.[^\\/.]+$/, '');
  assert(paired.every(item => {
    const jpeg = withRaw.copied.find(copy => copy.id === item.id && copy.format === 'jpeg');
    const raw = withRaw.copied.find(copy => copy.id === item.id && copy.format === 'raw');
    return jpeg && raw && stem(jpeg.path) === stem(raw.path);
  }), 'Collision-renamed JPEG and CR3 share the same destination stem');
  const allCopies = [...copies.copied, ...repeated.copied, ...withRaw.copied];
  assert(new Set(allCopies.map(item => item.path)).size === ids.length * 3 + paired.length, 'Collision copies receive distinct target names');
  return { passed: checks.length, checks, originalDimensions: [image.naturalWidth, image.naturalHeight], output: saved.path, copyCount: allCopies.length };
})();
