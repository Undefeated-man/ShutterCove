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
  const similar = await timeMachine.similar({ referenceId: photo.id, directory: settings.libraryRoot, grid: 8, limit: 10 });
  assert(similar.photos.length > 0, 'Native on-demand cosine search');
  return { passed: checks.length, checks, originalDimensions: [image.naturalWidth, image.naturalHeight], output: saved.path };
})();
