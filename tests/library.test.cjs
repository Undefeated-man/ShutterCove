'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const exifr = require('exifr');
const { PhotoLibrary, cosine, rgbFamily, inside } = require('../app/library.cjs');

async function fixture(t, options = {}) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-library-')));
  const root = path.join(directory, 'photos');
  await fs.mkdir(root);
  const library = await new PhotoLibrary({ userData: path.join(directory, 'userdata'), ...options }).init();
  t.after(async () => { await library.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { directory, root, library };
}

async function jpeg(file, color = '#cc4433', dimensions = 96) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp({ create: { width: dimensions, height: dimensions, channels: 3, background: color } }).jpeg().toFile(file);
  const date = new Date('2026-10-02T12:00:00+08:00');
  await fs.utimes(file, date, date);
  return file;
}

async function raw(file, text = 'raw-original') {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
  return file;
}

test('pairs RAW in trip root with JPEG in short date/照片 and 精品 folders', async t => {
  const { root, library } = await fixture(t);
  const trip = path.join(root, '2026秋日山海旅程');
  const regular = await jpeg(path.join(trip, '10.2', '照片', 'IMG_0001.JPG'));
  const premium = await jpeg(path.join(trip, '精品', 'IMG_0002.JPEG'));
  const rawOne = await raw(path.join(trip, 'IMG_0001.CR3'));
  const rawTwo = await raw(path.join(trip, 'IMG_0002.CR3'));
  const { photos } = await library.scan(root);
  assert.equal(photos.length, 2);
  const one = photos.find(photo => photo.stem === 'IMG_0001');
  const two = photos.find(photo => photo.stem === 'IMG_0002');
  assert.equal(one.jpegPath, regular);
  assert.equal(one.rawPath, rawOne);
  assert.equal(one.date, '2026-10-02');
  assert.equal(one.theme, '2026秋日山海旅程');
  assert.equal(two.jpegPath, premium);
  assert.equal(two.rawPath, rawTwo);
  assert.equal(two.favorite, true);
  assert.deepEqual(new Set(library.filePaths([one.id, two.id])), new Set([regular, premium, rawOne, rawTwo]));
  const nested = await library.scan(trip);
  assert.deepEqual(nested.photos.map(photo => photo.id).sort(), photos.map(photo => photo.id).sort());
});

test('identical camera file names remain separate across trips', async t => {
  const { root, library } = await fixture(t);
  for (const theme of ['山的回信', '海的来信']) {
    await jpeg(path.join(root, theme, '10.2', '照片', 'IMG_0001.JPG'));
    await raw(path.join(root, theme, 'IMG_0001.CR3'));
  }
  const { photos } = await library.scan(root);
  assert.equal(photos.length, 2);
  assert.equal(new Set(photos.map(photo => photo.id)).size, 2);
  assert.ok(photos.every(photo => path.dirname(photo.rawPath).endsWith(photo.theme)));
});

test('registered roots aggregate separate albums without mixing identical camera names or unrelated search scopes', async t => {
  const events = [];
  const { root, directory, library } = await fixture(t, { emit: event => events.push(event) });
  const mountain = path.join(root, '山的回信'), sea = path.join(root, '海的来信');
  await jpeg(path.join(mountain, 'IMG_0001.JPG'), '#335577');
  await raw(path.join(mountain, 'IMG_0001.CR3'));
  await jpeg(path.join(sea, 'IMG_0001.JPG'), '#884433');
  const original = (await library.scan(mountain)).photos[0];
  await library.update([original.id], { favorite: true, tags: ['山里'] });
  const outside = path.join(directory, 'similarity-only');
  await jpeg(path.join(outside, 'outside.JPG'));
  await library.similar({ referenceId: original.id, directory: outside, grid: 4 });
  assert.ok(library.roots.has(outside), 'similarity search authorizes its root');
  events.length = 0;
  const result = await library.scanRoots([mountain, sea]);
  assert.deepEqual(result.roots, [mountain, sea]);
  assert.equal(result.root, mountain);
  assert.deepEqual(result.unavailableRoots, []);
  assert.equal(result.photos.length, 2);
  assert.equal(new Set(result.photos.map(photo => photo.id)).size, 2);
  assert.deepEqual(new Set(result.photos.map(photo => photo.theme)), new Set(['山的回信', '海的来信']));
  assert.ok(result.photos.every(photo => photo.allPaths.every(file => !inside(outside, file))));
  assert.equal(result.photos.find(photo => photo.id === original.id).favorite, true);
  assert.deepEqual(result.photos.find(photo => photo.id === original.id).tags, ['山里']);
  const progress = events.filter(event => event.kind === 'scan' && event.phase === 'photos');
  assert.ok(progress.some(event => event.photos?.length && event.done < event.total));
  assert.ok(progress.every((event, index) => !index || event.done >= progress[index - 1].done), 'combined progress does not reset between folders');
  assert.equal(progress.at(-1).done, progress.at(-1).total);
  assert.equal(progress.at(-1).total, 3);
  const nonStreaming = await library.scanRoots([mountain, sea], { stream: false });
  assert.equal(nonStreaming.photos.length, 2);
});

test('overlapping registered roots prefer the specific scene, merge shared paths once, retain RAW pairs, and survive restart', async t => {
  const { root, library } = await fixture(t);
  const trip = path.join(root, '秋日旅程'), specific = path.join(trip, '2026-10-02');
  await jpeg(path.join(specific, 'IMG_0001.JPG'));
  const rawPath = await raw(path.join(trip, 'RAW', 'IMG_0001.CR3'));
  await jpeg(path.join(trip, '2026-10-03', 'IMG_0002.JPG'), '#cc8899');
  const original = (await library.scan(specific)).photos[0];
  await library.update([original.id], { favorite: false, tags: ['独立目录'], theme: '我命名的场景' });
  const result = await library.scanRoots([root, specific, root]);
  assert.deepEqual(result.roots, [root, specific]);
  assert.equal(result.photos.length, 2);
  const selected = result.photos.find(photo => photo.stem === 'IMG_0001');
  assert.equal(selected.id, original.id, 'specific-root identity wins even if parent root was registered first');
  assert.equal(selected.rawPath, rawPath);
  assert.equal(selected.theme, '我命名的场景');
  assert.equal(selected.favorite, false, 'an explicit unfavorite is retained during path merging');
  assert.deepEqual(selected.tags, ['独立目录']);
  const allPaths = result.photos.flatMap(photo => photo.allPaths);
  assert.equal(allPaths.length, 3);
  assert.equal(new Set(allPaths).size, allPaths.length);
  assert.equal(library.get(selected.id).rawPath, rawPath, 'the displayed winner remains usable by thumbnail/source requests');
  assert.ok(selected.allPaths.every(file => library.state.aliases[file] === selected.id));
  const metadataBeforeRestart = JSON.parse(JSON.stringify(library.state.metadata));
  const reopened = await new PhotoLibrary({ userData: library.userData }).init();
  try {
    const restarted = await reopened.scanRoots([root, specific]);
    const kept = restarted.photos.find(photo => photo.stem === 'IMG_0001');
    assert.equal(kept.id, original.id);
    assert.equal(kept.rawPath, rawPath);
    assert.deepEqual(kept.tags, ['独立目录']);
    assert.equal(kept.favorite, false);
    assert.equal(kept.theme, '我命名的场景');
    for (const id of Object.keys(metadataBeforeRestart)) assert.deepEqual(reopened.state.metadata[id], metadataBeforeRestart[id], 'old context metadata is not pruned');
  } finally { await reopened.close(); }
});

test('offline registered folders retain registration and metadata and reappear when their disk returns', async t => {
  const { root, directory, library } = await fixture(t);
  const connected = path.join(root, '在线相册'), removable = path.join(directory, '移动硬盘');
  await jpeg(path.join(connected, 'IMG_0001.JPG'));
  await jpeg(path.join(removable, 'IMG_0002.JPG'), '#445588');
  const initial = await library.scanRoots([connected, removable]);
  const offlinePhoto = initial.photos.find(photo => photo.stem === 'IMG_0002');
  await library.update([offlinePhoto.id], { favorite: true, tags: ['保留'] });
  const metadata = JSON.parse(JSON.stringify(library.state.metadata[offlinePhoto.id]));
  const parked = path.join(directory, 'temporarily-unmounted');
  await fs.rename(removable, parked);
  const disconnected = await library.scanRoots([connected, removable]);
  assert.deepEqual(disconnected.roots, [connected, removable]);
  assert.equal(disconnected.photos.length, 1);
  assert.equal(disconnected.unavailableRoots.length, 1);
  assert.equal(disconnected.unavailableRoots[0].root, removable);
  assert.deepEqual(library.state.metadata[offlinePhoto.id], metadata);
  await fs.rename(parked, removable);
  const returned = await library.scanRoots([connected, removable]);
  assert.deepEqual(returned.unavailableRoots, []);
  assert.equal(returned.photos.length, 2);
  const restored = returned.photos.find(photo => photo.id === offlinePhoto.id);
  assert.equal(restored.favorite, true);
  assert.deepEqual(restored.tags, ['保留']);
  const empty = await library.scanRoots([]);
  assert.equal(empty.root, '');
  assert.deepEqual(empty.roots, []);
  assert.deepEqual(empty.photos, []);
});

test('JPEG EXIF uses an owned bounded buffer instead of exifr file adapter', async t => {
  const { root, library } = await fixture(t);
  const file = await jpeg(path.join(root, 'large.jpg'));
  await fs.appendFile(file, Buffer.alloc(2 * 1024 * 1024));
  const originalParse = exifr.parse;
  const inputs = [];
  exifr.parse = async (input, options) => { inputs.push(input); return originalParse(input, options); };
  try {
    const result = await library.scan(root);
    assert.equal(result.photos.length, 1);
    assert.equal(inputs.length, 1);
    assert.ok(Buffer.isBuffer(inputs[0]));
    assert.ok(inputs[0].length <= 1024 * 1024);
    await library.scan(root);
    assert.equal(inputs.length, 1, 'unchanged photo uses persisted EXIF descriptor');
  } finally { exifr.parse = originalParse; }
});

test('scan streams a prioritized partial gallery before completion and cached scans avoid EXIF parsing', async t => {
  const events = [];
  const { root, library } = await fixture(t, { emit: event => events.push(event) });
  for (let index = 0; index < 20; index++) await jpeg(path.join(root, '10.2', '照片', `regular-${index}.jpg`));
  await jpeg(path.join(root, '精品', 'premium.jpg'));
  const originalDescribe = library._describe.bind(library);
  const described = [];
  library._describe = async (...args) => { described.push(args[0]); return originalDescribe(...args); };
  const result = await library.scan(root);
  assert.equal(result.photos.length, 21);
  assert.ok(described[0].includes(`${path.sep}精品${path.sep}`));
  const partial = events.find(event => event.kind === 'scan' && event.photos?.length && event.done < event.total);
  assert.ok(partial);
  assert.equal(partial.done, 12);
  assert.ok(partial.photos.some(photo => photo.favorite));
  assert.ok(partial.photos.every(photo => library.get(photo.id)));
  const originalParse = exifr.parse;
  let parseCalls = 0;
  exifr.parse = async (...args) => { parseCalls++; return originalParse(...args); };
  try { await library.scan(root); assert.equal(parseCalls, 0); }
  finally { exifr.parse = originalParse; }
  events.length = 0;
  await library.similar({ referenceId: result.photos[0].id, directory: root, grid: 4 });
  assert.ok(events.filter(event => event.kind === 'scan').every(event => !Object.hasOwn(event, 'photos') && event.stream === false));
});

test('RAW-only capture date comes from EXIF and cached metadata prevents repeat parsing and dates imports', async t => {
  const { root, directory, library } = await fixture(t);
  const file = await raw(path.join(root, 'IMG_9000.CR3'));
  let reads = 0;
  library.exifTool = {
    async read(input) {
      assert.equal(input, file);
      reads++;
      return { DateTimeOriginal: { toDate: () => new Date('2026-10-01T10:10:00+08:00') }, Make: 'Canon', Model: 'Canon EOS R6', LensModel: 'RF24-105mm', ImageWidth: 6000, ImageHeight: 4000 };
    },
    async end() {},
  };
  const scanned = await library.scan(root);
  assert.equal(scanned.photos[0].date, '2026-10-01');
  assert.equal(scanned.photos[0].width, 6000);
  assert.equal(scanned.photos[0].camera, 'Canon EOS R6');
  await library.scan(root);
  assert.equal(reads, 1);
  const destination = path.join(directory, 'imported-library');
  const imported = await library.importPhotos({ source: root, destination, theme: '从山川寄来' });
  assert.equal(reads, 1);
  assert.equal(imported.imported.length, 1);
  assert.equal(path.basename(path.dirname(imported.imported[0])), '2026-10-01');
  assert.equal(await fs.readFile(file, 'utf8'), 'raw-original');
});

test('tags, custom theme and explicit favorite choice persist across rescans and restart', async t => {
  const { root, directory, library } = await fixture(t);
  await jpeg(path.join(root, '精品', 'lake.JPG'));
  const { photos } = await library.scan(root);
  const id = photos[0].id;
  await library.update([id], { tags: ['日落', ' 日落 ', '旅行'], theme: '风经过的地方', favorite: false });
  await library.update([id], { addTags: ['胶片感'], removeTags: ['旅行'] });
  const restarted = await new PhotoLibrary({ userData: path.join(directory, 'userdata') }).init();
  t.after(() => restarted.close());
  const rescan = await restarted.scan(root);
  assert.deepEqual(rescan.photos[0].tags, ['日落', '胶片感']);
  assert.equal(rescan.photos[0].theme, '风经过的地方');
  assert.equal(rescan.photos[0].favorite, false);
  assert.equal(rescan.photos[0].id, id);
  assert.equal((await fs.readdir(path.join(root, '精品'))).length, 1);
});

test('thumbnail cache stays below cap, reuses previews, and never copies original JPEG', async t => {
  const { root, library } = await fixture(t, { cacheLimit: 4000 });
  for (let index = 0; index < 20; index++) await jpeg(path.join(root, `photo-${index}.jpg`), `rgb(${index * 10},60,100)`, 256);
  const { photos } = await library.scan(root);
  const first = await library.thumbnail(photos[0].id, 128);
  assert.equal(await library.thumbnail(photos[0].id, 128), first);
  for (const photo of photos.slice(1)) await library.thumbnail(photo.id, 128);
  const info = await library.cacheInfo();
  assert.ok(info.bytes <= info.limit, `${info.bytes} <= ${info.limit}`);
  assert.ok(info.files < photos.length);
  const direct = await library.source(photos.at(-1).id);
  assert.equal(direct, photos.at(-1).jpegPath);
  assert.ok((await fs.stat(direct)).isFile());
  assert.equal((await library.clearCache()).bytes, 0);
  assert.equal((await fs.readdir(root)).length, 20);
});

test('color analysis and on-demand pooled RGB cosine search produce progress and order', async t => {
  const events = [];
  const { root, library } = await fixture(t, { emit: event => events.push(event) });
  await jpeg(path.join(root, 'reference.jpg'), '#ee1010');
  await jpeg(path.join(root, 'similar.jpg'), '#dd2020');
  await jpeg(path.join(root, 'different.jpg'), '#1020ee');
  const { photos } = await library.scan(root);
  const reference = photos.find(photo => photo.name === 'reference');
  const analysis = await library.analyzeColors(photos.map(photo => photo.id));
  assert.equal(analysis.photos.length, 3);
  assert.equal(library.get(reference.id).colorFamily, 'red');
  const result = await library.similar({ referenceId: reference.id, directory: root, grid: 8, limit: 5 });
  assert.equal(result.photos[0].name, 'similar');
  assert.ok(result.photos[0].similarity > result.photos[1].similarity);
  assert.equal(result.grid, 8);
  assert.ok(events.some(event => event.kind === 'similarity' && event.done === event.total && event.etaSeconds === 0));
  assert.equal(cosine([0, 0, 0], [0, 0, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(rgbFamily([80, 80, 80]), 'gray');
  assert.ok(!(await fs.readdir(library.userData)).some(name => /vector/i.test(name)));
});

test('imports pairs without touching SD originals; collision rename stays paired and repeat import skips copies', async t => {
  const { root, directory, library } = await fixture(t);
  const source = path.join(directory, 'sd-card');
  const sourceJpeg = await jpeg(path.join(source, 'DCIM', 'IMG_1000.JPG'), '#22aa33');
  const sourceRaw = await raw(path.join(source, 'DCIM', 'IMG_1000.CR3'), 'new-raw');
  const existingJpeg = await jpeg(path.join(root, '旅途', '2026-10-02', 'IMG_1000.JPG'), '#aa2233');
  const existingRaw = await raw(path.join(root, '旅途', '2026-10-02', 'IMG_1000.CR3'), 'old-raw');
  const originalDigest = await library._digest(sourceJpeg);
  const imported = await library.importPhotos({ source, destination: root, theme: '旅途' });
  assert.equal(imported.errors.length, 0);
  assert.equal(imported.imported.length, 2);
  assert.ok(imported.imported.every(file => path.basename(file).startsWith('IMG_1000-2.')));
  assert.equal(await library._digest(sourceJpeg), originalDigest);
  assert.equal(await fs.readFile(sourceRaw, 'utf8'), 'new-raw');
  assert.equal(await fs.readFile(existingRaw, 'utf8'), 'old-raw');
  assert.ok((await fs.stat(existingJpeg)).isFile());
  const repeated = await library.importPhotos({ source, destination: root, theme: '旅途' });
  assert.equal(repeated.imported.length, 0);
  assert.equal(repeated.skipped, 2);
  assert.equal((await fs.readdir(path.join(root, '旅途', '2026-10-02'))).length, 4);
});

async function sourceSnapshot(library, root) {
  const entries = [];
  const walk = async directory => {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { entries.push({ directory: path.relative(root, file) }); await walk(file); }
      else {
        const stat = await fs.stat(file);
        entries.push({ file: path.relative(root, file), mtime: stat.mtimeMs, size: stat.size, digest: await library._digest(file) });
      }
    }
  };
  await walk(root);
  return entries;
}

test('importing an existing same-name theme indexes in place and preserves original files and metadata across a wider root', async t => {
  const events = [];
  const { root, library } = await fixture(t, { emit: event => events.push(event) });
  const source = path.join(root, '中秋小记');
  await jpeg(path.join(source, 'IMG_2001.JPG'));
  await raw(path.join(source, 'IMG_2001.CR3'));
  await jpeg(path.join(source, '精品', 'IMG_2002.JPG'), '#449922');
  const previous = (await library.scan(source)).photos;
  const favorite = previous.find(photo => photo.stem === 'IMG_2001');
  await library.update([favorite.id], { favorite: true, tags: ['家人'], theme: '旧的自定义主题' });
  const before = await sourceSnapshot(library, source);
  events.length = 0;
  const result = await library.importPhotos({ source, destination: root, theme: '中秋小记' });
  assert.equal(result.mode, 'indexed');
  assert.equal(result.indexedCount, 2);
  assert.equal(result.existingPaths.length, 3);
  assert.deepEqual(result.imported, []);
  assert.equal(result.skipped, 0);
  assert.equal(result.cancelled, false);
  assert.deepEqual(result.errors, []);
  assert.equal(result.libraryRoot, root);
  assert.equal(result.destination, source);
  assert.equal(result.theme, '中秋小记');
  assert.deepEqual(await sourceSnapshot(library, source), before, 'in-place indexing does not copy, move, rewrite, or redate originals');
  const wider = (await library.scan(root)).photos;
  assert.deepEqual(wider.map(photo => photo.id).sort(), previous.map(photo => photo.id).sort());
  assert.ok(wider.every(photo => photo.theme === '中秋小记'));
  const kept = wider.find(photo => photo.id === favorite.id);
  assert.equal(kept.favorite, true);
  assert.deepEqual(kept.tags, ['家人']);
  assert.ok(kept.rawPath && kept.jpegPath);
  assert.ok(events.some(event => event.kind === 'import' && event.phase === 'preparing'));
  assert.ok(events.some(event => event.kind === 'import' && event.phase === 'metadata' && event.done === 3));
  assert.ok(events.some(event => event.kind === 'import' && event.phase === 'indexing' && event.done === event.total));
  assert.equal(library.jobs.has('import'), false);
});

test('a source already inside the destination is copied to a different theme instead of deduplicated against itself', async t => {
  const { root, library } = await fixture(t);
  const source = path.join(root, '现有主题');
  await jpeg(path.join(source, 'IMG_2001.JPG'));
  await raw(path.join(source, 'IMG_2001.CR3'));
  const before = await sourceSnapshot(library, source);
  const result = await library.importPhotos({ source, destination: root, theme: '新主题' });
  assert.equal(result.mode, 'copied');
  assert.equal(result.imported.length, 2);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.errors, []);
  assert.ok(result.imported.every(file => inside(path.join(root, '新主题'), file)));
  assert.deepEqual(await sourceSnapshot(library, source), before);
  const newPhotos = (await library.scan(root)).photos.filter(photo => photo.theme === '新主题');
  assert.equal(newPhotos.length, 1);
  assert.ok(newPhotos[0].jpegPath && newPhotos[0].rawPath);
  const repeated = await library.importPhotos({ source, destination: root, theme: '新主题' });
  assert.deepEqual(repeated.imported, []);
  assert.equal(repeated.skipped, 2);
  assert.equal((await fs.readdir(path.join(root, '新主题', '2026-10-02'))).length, 2);
  assert.equal(library.jobs.has('import'), false);
});

test('empty and fully deduplicated imports do not leave empty theme folders', async t => {
  const { root, directory, library } = await fixture(t);
  const source = path.join(directory, 'source');
  await fs.mkdir(source);
  const empty = await library.importPhotos({ source, destination: root, theme: '空主题' });
  assert.deepEqual(empty.imported, []);
  await assert.rejects(fs.lstat(path.join(root, '空主题')), { code: 'ENOENT' });
  await jpeg(path.join(source, 'IMG_2001.JPG'));
  const first = await library.importPhotos({ source, destination: root, theme: '已有主题' });
  assert.equal(first.imported.length, 1);
  const duplicate = await library.importPhotos({ source, destination: root, theme: '另一个主题' });
  assert.equal(duplicate.skipped, 1, 'existing cross-theme deduplication is preserved');
  await assert.rejects(fs.lstat(path.join(root, '另一个主题')), { code: 'ENOENT' });
  assert.equal(library.jobs.has('import'), false);
});

test('import progress starts before folder preparation and cancellation during preparation leaves no copies', async t => {
  const events = [];
  const { root, directory, library } = await fixture(t, { emit: event => events.push(event) });
  const source = path.join(directory, 'source');
  await jpeg(path.join(source, 'IMG_2001.JPG'));
  const before = await sourceSnapshot(library, source);
  const walk = library._walk.bind(library);
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  library._walk = async (...args) => { entered(); await blocked; return walk(...args); };
  const pending = library.importPhotos({ source, destination: root, theme: '取消主题' });
  await started;
  assert.ok(events.some(event => event.kind === 'import' && event.phase === 'preparing' && event.done === 0));
  assert.equal(library.cancel('import'), true);
  release();
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.imported, []);
  assert.deepEqual(await sourceSnapshot(library, source), before);
  await assert.rejects(fs.lstat(path.join(root, '取消主题')), { code: 'ENOENT' });
  assert.equal(library.jobs.has('import'), false);
});

test('cancellation during metadata reading is responsive and in-place indexing does not commit a cancelled theme', async t => {
  const { root, library } = await fixture(t);
  const source = path.join(root, '现有主题');
  for (let index = 0; index < 8; index++) await jpeg(path.join(source, `IMG_${index}.JPG`));
  const previous = (await library.scan(source)).photos;
  await library.update(previous.map(photo => photo.id), { theme: '原主题' });
  const before = await sourceSnapshot(library, source);
  const describe = library._describe.bind(library);
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  let count = 0;
  library._describe = async (...args) => { count++; entered(); await blocked; return describe(...args); };
  const pending = library.importPhotos({ source, destination: root, theme: '现有主题' });
  await started;
  assert.equal(library.cancel('import'), true);
  release();
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.equal(result.indexedCount, 0);
  assert.ok(count <= 4, 'queued metadata reads stop when cancellation is requested');
  assert.ok(previous.every(photo => library.get(photo.id).theme === '原主题'));
  assert.deepEqual(await sourceSnapshot(library, source), before);
  assert.equal(library.jobs.has('import'), false);
});

test('preparation and metadata failures clean import jobs and unsafe nested destinations are still refused', async t => {
  const { root, directory, library } = await fixture(t);
  const source = path.join(directory, 'source');
  await jpeg(path.join(source, 'IMG_2001.JPG'));
  const before = await sourceSnapshot(library, source);
  const walk = library._walk;
  library._walk = async () => { throw new Error('synthetic preparation failure'); };
  await assert.rejects(library.importPhotos({ source, destination: root, theme: '失败主题' }), /synthetic preparation failure/);
  assert.equal(library.jobs.has('import'), false);
  library._walk = walk;
  const describe = library._describe;
  library._describe = async () => { throw new Error('synthetic metadata failure'); };
  const failed = await library.importPhotos({ source, destination: root, theme: '失败主题' });
  assert.equal(failed.errors.length, 1);
  assert.match(failed.errors[0].message, /synthetic metadata failure/);
  assert.deepEqual(failed.imported, []);
  assert.equal(library.jobs.has('import'), false);
  library._describe = describe;
  await assert.rejects(fs.lstat(path.join(root, '失败主题')), { code: 'ENOENT' });
  await assert.rejects(library.importPhotos({ source, destination: source, theme: '递归目标' }), /不能相互包含/);
  const nestedSource = path.join(root, '嵌套主题', '来源');
  await jpeg(path.join(nestedSource, 'IMG_3001.JPG'));
  await assert.rejects(library.importPhotos({ source: nestedSource, destination: root, theme: '嵌套主题' }), /不能相互包含/);
  assert.deepEqual(await sourceSnapshot(library, source), before);
  assert.equal(library.jobs.has('import'), false);
});

test('failed copy verification removes the incomplete imported file and clears the job without changing originals', async t => {
  const { root, directory, library } = await fixture(t);
  const source = path.join(directory, 'source');
  await jpeg(path.join(source, 'IMG_2001.JPG'));
  const before = await sourceSnapshot(library, source);
  const digest = library._digest.bind(library);
  library._digest = file => inside(root, file) ? Promise.reject(new Error('synthetic copy verification failure')) : digest(file);
  const result = await library.importPhotos({ source, destination: root, theme: '校验失败' });
  assert.deepEqual(result.imported, []);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /synthetic copy verification failure/);
  assert.deepEqual(await fs.readdir(path.join(root, '校验失败', '2026-10-02')), []);
  assert.deepEqual(await sourceSnapshot(library, source), before);
  assert.equal(library.jobs.has('import'), false);
});

test('selected copy defaults to preferred JPEG, explains RAW-only skips, and optionally includes original CR3', async t => {
  const { root, directory, library } = await fixture(t);
  library.exifTool = { async read() { return { DateTimeOriginal: new Date('2026-10-02T12:00:00+08:00') }; }, async end() {} };
  const regular = await jpeg(path.join(root, '10.2', '照片', 'KEEP.JPG'), '#118833');
  const preferred = await jpeg(path.join(root, '精品', 'KEEP.JPG'), '#cc7733');
  const pairedRaw = await raw(path.join(root, 'RAW', 'KEEP.CR3'));
  const rawOnly = await raw(path.join(root, 'RAW', 'LONE.CR3'), 'raw-only-original');
  const originals = [regular, preferred, pairedRaw, rawOnly];
  const before = await Promise.all(originals.map(file => library._digest(file)));
  const scanned = await library.scan(root);
  const ids = scanned.photos.map(photo => photo.id);
  const output = path.join(directory, 'picked-jpeg');
  await fs.mkdir(output);
  const result = await library.copySelected({ ids: [...ids, ids[0]], directory: output });
  assert.equal(result.directory, output);
  assert.equal(result.copiedCount, 1);
  assert.equal(result.copied[0].source, preferred);
  assert.equal(await library._digest(result.copied[0].path), await library._digest(preferred));
  assert.equal((await fs.stat(result.copied[0].path)).mtimeMs, (await fs.stat(preferred)).mtimeMs);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.skipped[0].reason, 'raw-only');
  assert.match(result.skipped[0].message, /包含 CR3/);
  assert.equal(result.errorCount, 0);
  assert.equal(result.cancelled, false);
  assert.deepEqual(await fs.readdir(output), ['KEEP.JPG']);
  const withRaw = path.join(directory, 'picked-with-raw');
  await fs.mkdir(withRaw);
  const complete = await library.copySelected({ ids, directory: withRaw, includeRaw: true });
  assert.equal(complete.copiedCount, 3);
  assert.equal(complete.skippedCount, 0);
  assert.deepEqual((await fs.readdir(withRaw)).sort(), ['KEEP.CR3', 'KEEP.JPG', 'LONE.CR3']);
  assert.deepEqual(await Promise.all(originals.map(file => library._digest(file))), before);
  assert.deepEqual((await library.scan(root)).photos.map(photo => photo.id).sort(), ids.sort(), 'copy does not change library identities');
});

test('selected copy flattens cross-directory camera-name collisions with one suffix per JPEG/CR3 pair and never overwrites', async t => {
  const { root, directory, library } = await fixture(t);
  const originals = [];
  for (const [index, theme] of ['山的回信', '海的来信'].entries()) {
    originals.push(await jpeg(path.join(root, theme, '10.2', '照片', `IMG_1000.${index ? 'JPEG' : 'JPG'}`), index ? '#22aa33' : '#aa2233'));
    originals.push(await raw(path.join(root, theme, 'RAW', 'IMG_1000.CR3'), `raw-${index}`));
  }
  const before = await Promise.all(originals.map(file => library._digest(file)));
  const photos = (await library.scan(root)).photos;
  assert.equal(photos.length, 2);
  const output = path.join(directory, 'picked');
  await fs.mkdir(output);
  const existingRaw = path.join(output, 'IMG_1000.CR3');
  const caseCollision = path.join(output, 'img_1000-2.JPEG');
  await fs.writeFile(existingRaw, 'already-here');
  await fs.writeFile(caseCollision, 'case-insensitive-collision');
  const result = await library.copySelected({ ids: photos.map(photo => photo.id), directory: output, includeRaw: true });
  assert.equal(result.copiedCount, 4);
  assert.equal(result.errorCount, 0);
  for (const photo of photos) {
    const group = result.copied.filter(file => file.id === photo.id);
    assert.equal(group.length, 2);
    assert.equal(new Set(group.map(file => path.basename(file.path, path.extname(file.path)))).size, 1);
    assert.ok(group.every(file => /^IMG_1000-[34]\./.test(path.basename(file.path))));
    for (const file of group) assert.equal(await library._digest(file.path), await library._digest(file.source));
  }
  assert.equal(await fs.readFile(existingRaw, 'utf8'), 'already-here');
  assert.equal(await fs.readFile(caseCollision, 'utf8'), 'case-insensitive-collision');
  assert.deepEqual(await Promise.all(originals.map(file => library._digest(file))), before);
  assert.equal((await fs.readdir(output)).length, 6);
});

test('selected copy cancellation keeps completed pairs and reports group progress without copying the next group', async t => {
  let library;
  const events = [];
  const data = await fixture(t, { emit: event => { events.push(event); if (event.kind === 'copy' && event.done === 1) library.cancel('copy'); } });
  library = data.library;
  for (const stem of ['FIRST', 'SECOND']) {
    await jpeg(path.join(data.root, `${stem}.JPG`));
    await raw(path.join(data.root, 'RAW', `${stem}.CR3`));
  }
  const photos = (await library.scan(data.root)).photos;
  const output = path.join(data.directory, 'picked');
  await fs.mkdir(output);
  const result = await library.copySelected({ ids: photos.map(photo => photo.id), directory: output, includeRaw: true });
  assert.equal(result.cancelled, true);
  assert.equal(result.copiedCount, 2);
  assert.equal(result.errorCount, 0);
  assert.deepEqual((await fs.readdir(output)).sort(), ['FIRST.CR3', 'FIRST.JPG']);
  const last = events.filter(event => event.kind === 'copy').at(-1);
  assert.equal(last.done, 1);
  assert.equal(last.total, 2);
  assert.equal(last.cancelled, true);
  assert.equal(library.jobs.has('copy'), false);
  assert.equal((await library._walk(data.root)).length, 4);
});

test('selected copy rejects source folders, symlink destinations, invalid selection and changed symlink sources without extending library authorization', async t => {
  const { root, directory, library } = await fixture(t);
  const source = await jpeg(path.join(root, 'SOURCE.JPG'));
  const id = (await library.scan(root)).photos[0].id;
  const output = path.join(directory, 'picked');
  await fs.mkdir(output);
  const linkedOutput = path.join(directory, 'linked-output');
  await fs.symlink(output, linkedOutput);
  await assert.rejects(library.copySelected({ ids: [id], directory: linkedOutput }), /符号链接/);
  await assert.rejects(library.copySelected({ ids: [id], directory: root }), /原片所在文件夹/);
  await assert.rejects(library.copySelected({ ids: [], directory: output }), /请选择/);
  await assert.rejects(library.copySelected({ ids: Array(50001).fill(id), directory: output }), /50,000/);
  await assert.rejects(library.copySelected({ ids: ['stale-id'], directory: output }), /找不到/);
  await assert.rejects(library.copySelected({ ids: [id], directory: output, includeRaw: 'false' }), /是否包含/);
  const outside = await jpeg(path.join(directory, 'private', 'OUTSIDE.JPG'));
  await fs.rm(source);
  await fs.symlink(outside, source);
  const result = await library.copySelected({ ids: [id], directory: output });
  assert.equal(result.copiedCount, 0);
  assert.equal(result.errorCount, 1);
  assert.match(result.errors[0].message, /符号链接/);
  assert.deepEqual(await fs.readdir(output), []);
  assert.equal(library.roots.has(output), false);
  await assert.rejects(library._authorized(outside), /已选择/);
});

test('selected copy retries a pair together when a destination appears after collision preflight', async t => {
  const { root, directory, library } = await fixture(t);
  const sourceJpeg = await jpeg(path.join(root, 'RACE.JPG'));
  const sourceRaw = await raw(path.join(root, 'RAW', 'RACE.CR3'));
  const photo = (await library.scan(root)).photos[0];
  const output = path.join(directory, 'picked');
  await fs.mkdir(output);
  const originalCopy = fs.copyFile;
  let injected = false;
  fs.copyFile = async (source, target, flags) => {
    assert.equal(flags, require('node:fs').constants.COPYFILE_EXCL);
    if (source === sourceRaw && !injected) { injected = true; await fs.writeFile(target, 'concurrent-existing-file', { flag: 'wx' }); }
    return originalCopy(source, target, flags);
  };
  let result;
  try { result = await library.copySelected({ ids: [photo.id], directory: output, includeRaw: true }); }
  finally { fs.copyFile = originalCopy; }
  assert.equal(result.copiedCount, 2);
  assert.equal(result.errorCount, 0);
  assert.ok(result.copied.every(file => path.basename(file.path).startsWith('RACE-2.')));
  assert.deepEqual((await fs.readdir(output)).sort(), ['RACE-2.CR3', 'RACE-2.JPG', 'RACE.CR3']);
  assert.equal(await fs.readFile(path.join(output, 'RACE.CR3'), 'utf8'), 'concurrent-existing-file');
  assert.equal(await library._digest(path.join(output, 'RACE-2.JPG')), await library._digest(sourceJpeg));
  assert.equal(await library._digest(path.join(output, 'RACE-2.CR3')), await library._digest(sourceRaw));
});

test('selected copy returns a successful JPEG and a useful RAW failure while originals remain untouched', async t => {
  const { root, directory, library } = await fixture(t);
  const sourceJpeg = await jpeg(path.join(root, 'PARTIAL.JPG'));
  const sourceRaw = await raw(path.join(root, 'RAW', 'PARTIAL.CR3'));
  const originals = await Promise.all([sourceJpeg, sourceRaw].map(file => library._digest(file)));
  const photo = (await library.scan(root)).photos[0];
  const output = path.join(directory, 'picked');
  await fs.mkdir(output);
  const originalCopy = fs.copyFile;
  fs.copyFile = async (source, target, flags) => {
    if (source === sourceRaw) throw Object.assign(new Error('模拟磁盘写入失败'), { code: 'EIO' });
    return originalCopy(source, target, flags);
  };
  let result;
  try { result = await library.copySelected({ ids: [photo.id], directory: output, includeRaw: true }); }
  finally { fs.copyFile = originalCopy; }
  assert.equal(result.copiedCount, 1);
  assert.equal(result.copied[0].format, 'jpeg');
  assert.equal(result.errorCount, 1);
  assert.equal(result.errors[0].source, sourceRaw);
  assert.match(result.errors[0].message, /写入失败/);
  assert.deepEqual(await fs.readdir(output), ['PARTIAL.JPG']);
  assert.deepEqual(await Promise.all([sourceJpeg, sourceRaw].map(file => library._digest(file))), originals);
});

test('scan skips symbolic links and source access rejects roots outside selected directories', async t => {
  const { root, directory, library } = await fixture(t);
  const outside = await jpeg(path.join(directory, 'private', 'outside.jpg'));
  await fs.symlink(outside, path.join(root, 'linked.jpg'));
  await fs.symlink(path.dirname(outside), path.join(root, 'linked-folder'));
  const { photos } = await library.scan(root);
  assert.equal(photos.length, 0);
  await assert.rejects(library._authorized(outside), /已选择/);
  await assert.rejects(library.scan(path.join(root, 'linked-folder')), /符号链接/);
  await assert.rejects(library.importPhotos({ source: root, destination: path.join(directory, 'target'), theme: '../escape' }), /路径分隔符/);
  assert.equal(inside('/photo', '/photos-other/file'), false);
  const realPhoto = await jpeg(path.join(root, 'real.jpg'));
  const scanned = await library.scan(root);
  await fs.rm(realPhoto);
  await fs.symlink(outside, realPhoto);
  await assert.rejects(library.authorizePaths([scanned.photos[0].id]), /符号链接/);
});

async function syncFixture(t, options) {
  const fixtureData = await fixture(t, options);
  const { root, directory, library } = fixtureData;
  await jpeg(path.join(root, '精品', 'KEEP.JPG'));
  const selected = (await library.scan(root)).photos[0];
  const sd = path.join(directory, 'SD');
  await jpeg(path.join(sd, 'DCIM', 'KEEP.JPG'));
  await raw(path.join(sd, 'DCIM', 'KEEP.CR3'));
  await jpeg(path.join(sd, 'DCIM', 'OTHER.JPG'), '#118833');
  await raw(path.join(sd, 'DCIM', 'OTHER.CR3'), 'other-raw');
  await fs.writeFile(path.join(sd, 'DCIM', 'movie.mp4'), 'video-untouched');
  await jpeg(path.join(sd, '待删', 'old-batch', 'OLD.JPG'));
  return { ...fixtureData, selected, sd };
}

test('SD sync keeps selected JPEG+CR3, moves other photos with identical bytes, ignores videos and prior 待删, and restores', async t => {
  const { library, selected, sd } = await syncFixture(t);
  const other = path.join(sd, 'DCIM', 'OTHER.JPG');
  const before = await library._digest(other);
  const plan = await library.syncPreview({ directory: sd, ids: [selected.id] });
  assert.equal(plan.keepCount, 2);
  assert.equal(plan.moveCount, 2);
  assert.deepEqual(plan.unmatched, []);
  const result = await library.syncFavorites({ token: plan.token });
  assert.equal(result.movedCount, 2);
  assert.equal(await library._digest(path.join(result.batchDirectory, 'DCIM', 'OTHER.JPG')), before);
  assert.equal(await fs.readFile(path.join(sd, 'DCIM', 'KEEP.CR3'), 'utf8'), 'raw-original');
  assert.equal(await fs.readFile(path.join(sd, 'DCIM', 'movie.mp4'), 'utf8'), 'video-untouched');
  assert.ok((await fs.stat(path.join(sd, '待删', 'old-batch', 'OLD.JPG'))).isFile());
  assert.equal((await library._walk(sd)).length, 2);
  const restored = await library.restoreSync({ batchDirectory: result.batchDirectory });
  assert.equal(restored.restoredCount, 2);
  assert.equal(restored.errors.length, 0);
  assert.equal(await library._digest(other), before);
});

test('SD sync blocks zero matches, duplicate camera names with different dates, and stale file plans before moving', async t => {
  const { library, selected, sd, root } = await syncFixture(t);
  await jpeg(path.join(root, 'MISSING.JPG'));
  const missing = (await library.scan(root)).photos.find(photo => photo.name === 'MISSING');
  await assert.rejects(library.syncPreview({ directory: sd, ids: [missing.id] }), /没有找到/);
  const collision = await jpeg(path.join(sd, '2026-10-03', 'KEEP.JPG'));
  await assert.rejects(library.syncPreview({ directory: sd, ids: [selected.id] }), /同名.*日期不同/);
  await fs.rm(collision);
  const plan = await library.syncPreview({ directory: sd, ids: [selected.id] });
  await fs.appendFile(path.join(sd, 'DCIM', 'OTHER.CR3'), 'changed');
  await assert.rejects(library.syncFavorites({ token: plan.token }), /已变化/);
  assert.ok((await fs.stat(path.join(sd, 'DCIM', 'OTHER.JPG'))).isFile());
  assert.equal(await fs.readFile(path.join(sd, 'DCIM', 'OTHER.CR3'), 'utf8'), 'other-rawchanged');
});

test('SD sync cancellation stops after completed move and retains a recoverable journal', async t => {
  let library;
  const data = await syncFixture(t, { emit: event => { if (event.kind === 'sync' && event.done === 1) library.cancel('sync'); } });
  library = data.library;
  const plan = await library.syncPreview({ directory: data.sd, ids: [data.selected.id] });
  const result = await library.syncFavorites({ token: plan.token });
  assert.equal(result.cancelled, true);
  assert.equal(result.movedCount, 1);
  const journal = JSON.parse(await fs.readFile(path.join(result.batchDirectory, '同步记录.json'), 'utf8'));
  assert.equal(journal.cancelled, true);
  assert.equal((await library.restoreSync({ batchDirectory: result.batchDirectory })).restoredCount, 1);
  assert.ok((await fs.stat(path.join(data.sd, 'DCIM', 'OTHER.JPG'))).isFile());
  assert.ok((await fs.stat(path.join(data.sd, 'DCIM', 'OTHER.CR3'))).isFile());
});
