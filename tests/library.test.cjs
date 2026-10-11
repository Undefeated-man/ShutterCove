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
