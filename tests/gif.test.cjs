'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const sharp = require('sharp');
const { GifService } = require('../app/gif-service.cjs');
const model = require('../renderer/motion-model.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const overlay = (text = '光影 & <记忆>') => ({ type: 'speech', text, x: .1, y: .1, width: .48, font: .045, color: '#253c35', fill: '#fffaf0' });
const request = (overrides = {}) => ({ frames: [{ id: 'red', overlays: [] }, { id: 'blue', overlays: [] }], width: 160, height: 120, colors: 256, delay: 320, loop: true, background: '#faf7ee', ...overrides });
async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shiguang-gif-')), paths = new Map(), original = new Map(), authorized = [], progress = [];
  for (const [id, color, width, height] of [['red', '#d33232', 200, 100], ['blue', '#3259d3', 100, 200], ['green', '#36c166', 100, 100]]) {
    const file = path.join(dir, id + '.JPG'); await sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toFile(file); paths.set(id, file); original.set(file, hash(await fs.readFile(file)));
  }
  const service = new GifService({ library: { authorizePaths: async (ids, format) => { authorized.push({ ids, format }); if (!paths.has(ids[0])) throw new Error('未索引照片'); return [paths.get(ids[0])]; } }, emit: event => progress.push(event), ...options });
  t.after(async () => { await service.close(); await fs.rm(dir, { recursive: true, force: true }); });
  return { dir, paths, original, authorized, progress, service };
}
const data = result => Buffer.from(result.dataUrl.slice(result.dataUrl.indexOf(',') + 1), 'base64');
async function pixel(bytes, frame, x, y) { const { data, info } = await sharp(bytes, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return [...data.subarray(((frame * 120 + y) * info.width + x) * 4, ((frame * 120 + y) * info.width + x) * 4 + 4)]; }

test('GIF worker writes real ordered frames with timing, contain layout and exact preview bytes', async t => {
  const { dir, original, authorized, progress, service } = await fixture(t);
  const result = await service.preview(request()), bytes = data(result), metadata = await sharp(bytes, { animated: true }).metadata();
  assert.equal(bytes.toString('ascii', 0, 6), 'GIF89a'); assert.equal(metadata.format, 'gif'); assert.equal(metadata.pages, 2); assert.equal(metadata.width, 160); assert.equal(metadata.pageHeight, 120); assert.deepEqual(metadata.delay, [320, 320]); assert.equal(metadata.loop, 0); assert.equal(result.durationMs, 640);
  const red = await pixel(bytes, 0, 80, 60), blue = await pixel(bytes, 1, 80, 60), top = await pixel(bytes, 0, 80, 3), left = await pixel(bytes, 1, 3, 60);
  assert.ok(red[0] > 180 && red[2] < 80); assert.ok(blue[2] > 180 && blue[0] < 80); assert.ok(top[0] > 220 && top[1] > 220); assert.ok(left[0] > 220 && left[1] > 220);
  assert.deepEqual(authorized, [{ ids: ['red'], format: 'jpeg' }, { ids: ['blue'], format: 'jpeg' }]); assert.equal(progress.at(-1).stage, 'ready'); assert.deepEqual(progress.map(event => event.done), [0, 1, 2, 3]);
  const target = path.join(dir, 'new.gif'); await service.save(result.token, target); assert.equal(hash(await fs.readFile(target)), hash(bytes));
  for (const [file, digest] of original) assert.equal(hash(await fs.readFile(file)), digest);
  assert.ok((await fs.readdir(dir)).every(name => !name.endsWith('.tmp')));
});
test('reordered identical frames remain separate, delay is rounded to GIF centiseconds and loop once is encoded', async t => {
  const { service } = await fixture(t); const result = await service.preview(request({ frames: [{ id: 'blue' }, { id: 'red' }, { id: 'red' }], delay: 325, loop: false, colors: 64 }));
  const metadata = await sharp(data(result), { animated: true }).metadata(); assert.equal(metadata.pages, 3); assert.deepEqual(metadata.delay, [330, 330, 330]); assert.equal(metadata.loop, 1);
  assert.ok((await pixel(data(result), 0, 80, 60))[2] > 180); assert.ok((await pixel(data(result), 2, 80, 60))[0] > 180);
});
test('per-frame bubble overlays change only the requested frame and escape XML', async t => {
  const { service } = await fixture(t); const first = await service.preview(request()); const plain = data(first);
  const edited = await service.preview(request({ frames: [{ id: 'red', overlays: [overlay()] }, { id: 'blue' }] }));
  const bubble = await pixel(data(edited), 0, 20, 20), before = await pixel(plain, 0, 20, 20);
  assert.notDeepEqual(bubble, before); assert.deepEqual(await pixel(data(edited), 1, 80, 60), await pixel(plain, 1, 80, 60));
  assert.ok(model.svg([overlay('<script>&"')], 500, 300).includes('&lt;script&gt;&amp;&quot;'));
});
test('GIF request rejects unauthorized paths, bad overlays and unbounded memory before image processing', async t => {
  const { service, authorized } = await fixture(t);
  for (const value of [request({ frames: [{ id: 'red', path: '/etc/passwd' }, { id: 'blue' }] }), request({ width: 1601 }), request({ frames: Array.from({ length: 81 }, () => ({ id: 'red' })) }), request({ width: 1600, height: 1600, frames: Array.from({ length: 10 }, () => ({ id: 'red' })) }), request({ frames: [{ id: 'red', overlays: [{ ...overlay(), x: -1 }] }, { id: 'blue' }] }), request({ frames: [{ id: 'red', overlays: [{ ...overlay(), text: 'x'.repeat(121) }] }, { id: 'blue' }] }), request({ frames: [{ id: 'red', overlays: [{ ...overlay(), color: 'url(file:secret)' }] }, { id: 'blue' }] }), request({ delay: NaN }), request({ colors: 128.5 }), request({ loop: 1 })]) await assert.rejects(service.preview(value));
  assert.equal(authorized.length, 0); await assert.rejects(service.preview(request({ frames: [{ id: '/etc/passwd' }, { id: 'blue' }] })), /未索引/);
});
test('RAW-only indexed entries cannot be used as GIF file sources', async t => {
  const { service, paths } = await fixture(t); paths.set('raw', path.join(os.tmpdir(), 'original.CR3')); await assert.rejects(service.preview(request({ frames: [{ id: 'raw' }, { id: 'red' }] })), /JPEG/);
});
test('cancel terminates a live worker, clears ready data and permits a fresh request', async t => {
  let started; const waitStart = new Promise(resolve => started = resolve);
  const fake = () => { const worker = new EventEmitter(); worker.terminated = false; worker.terminate = async () => { worker.terminated = true; }; started(worker); return worker; };
  const { service } = await fixture(t, { workerFactory: fake }); const running = service.preview(request()); const worker = await waitStart;
  await assert.rejects(service.preview(request()), /正在生成/); await service.cancel(); assert.deepEqual(await running, { canceled: true }); assert.equal(worker.terminated, true); assert.equal(service.ready, null); assert.equal(service.job, null); assert.equal(service.preparing, false);
});
test('cancel during source authorization starts no worker', async t => {
  let resolveSource, count = 0; const waitSource = new Promise(resolve => resolveSource = resolve);
  const service = new GifService({ library: { authorizePaths: async () => { await waitSource; return ['synthetic.JPG']; } }, workerFactory: () => { count++; throw new Error('Must not start'); } }); t.after(() => service.close());
  const running = service.preview(request()); await new Promise(resolve => setImmediate(resolve)); await service.cancel(); resolveSource(); assert.deepEqual(await running, { canceled: true }); assert.equal(count, 0);
});
test('hard deadline terminates stalled encoding and releases its memory', async t => {
  const worker = new EventEmitter(); worker.terminate = async () => { worker.stopped = true; }; const { service } = await fixture(t, { workerFactory: () => worker, timeoutMs: 25 });
  const hold = setTimeout(() => {}, 1000); try { await assert.rejects(service.preview(request()), /超过 2 分钟/); assert.equal(worker.stopped, true); assert.equal(service.job, null); } finally { clearTimeout(hold); }
});
test('corrupt source rejection leaves no generated files and can retry', async t => {
  const { service, dir, paths } = await fixture(t); const damaged = path.join(dir, 'damaged.JPG'); await fs.writeFile(damaged, 'not a jpeg'); paths.set('damaged', damaged);
  await assert.rejects(service.preview(request({ frames: [{ id: 'damaged' }, { id: 'red' }] }))); assert.equal(service.job, null); assert.equal(service.ready, null);
  const result = await service.preview(request()); assert.equal(result.frames, 2); assert.deepEqual((await fs.readdir(dir)).sort(), ['blue.JPG', 'damaged.JPG', 'green.JPG', 'red.JPG']);
});
test('save tokens expire, can be released, cannot overwrite JPEG/RAW and cleanup removes temp writes', async t => {
  const { service, dir } = await fixture(t); const result = await service.preview(request()); await assert.rejects(service.save(result.token, path.join(dir, 'original.jpg')), /\.gif/); await assert.rejects(service.save('bad-token', path.join(dir, 'new.gif')), /失效/);
  service.ready.created = Date.now() - 3600001; await assert.rejects(service.save(result.token, path.join(dir, 'new.gif')), /失效/);
  const fresh = await service.preview(request()); service.release(fresh.token); await assert.rejects(service.save(fresh.token, path.join(dir, 'new.gif')), /失效/); assert.equal(service.ready, null);
});
test('demo generation encodes real synthetic multi-frame GIF and production never accepts uploaded sources', async t => {
  const { service } = await fixture(t, { allowDemo: true }); const sources = await Promise.all(['#cd4444', '#4444cd'].map(async color => 'data:image/png;base64,' + (await sharp({ create: { width: 160, height: 120, channels: 3, background: color } }).png().toBuffer()).toString('base64')));
  const options = request({ frames: [{ id: 'demo-0' }, { id: 'demo-1' }] }); const result = await service.previewDemo(options, sources); assert.equal((await sharp(data(result), { animated: true }).metadata()).pages, 2); assert.ok((await pixel(data(result), 1, 80, 60))[2] > 180);
  await assert.rejects(service.preview({ ...options, demoSources: sources }), /只能使用/);
  const production = new GifService({ library: {} }); await assert.rejects(production.previewDemo(options, sources), /仅在演示/);
  await assert.rejects(service.previewDemo(options, ['data:image/svg+xml;base64,AAA', sources[1]]), /PNG 或 JPEG/);
  await assert.rejects(service.previewDemo(request({ frames: [{ id: 'demo-99' }, { id: 'demo-1' }] }), sources), /PNG 或 JPEG/);
});
test('overlay geometry keeps bubbles within extreme portrait/landscape frames', () => {
  assert.deepEqual(model.geometry(overlay('把光留住，\n把日子过成电影。'), 720, 480).lines, ['把光留住，', '把日子过成电影。']);
  for (const [width, height] of [[96, 1600], [1600, 96], [96, 96]]) for (const type of ['speech', 'thought', 'text']) { const g = model.geometry({ ...overlay('长文字'.repeat(30)), type, x: .99, y: .99, width: .12, font: .12 }, width, height); assert.ok(g.x >= 0 && g.y >= 0 && g.w > 0 && g.h > 0); assert.ok(g.x + g.w <= width && g.y + g.h + g.tail <= height + .01); assert.ok(g.lines.length >= 1); }
});
test('extreme wide GIF frames with maximal bubbles still encode valid positive geometry', async t => {
  const { service } = await fixture(t); const result = await service.preview(request({ width: 1600, height: 96, frames: [{ id: 'red', overlays: [{ ...overlay('WIDE MEMORIES'), font: .12, width: .12, x: .99, y: .99 }] }, { id: 'blue', overlays: [{ ...overlay('THOUGHTS'), type: 'thought', font: .12, width: .12 }] }] }));
  const metadata = await sharp(data(result), { animated: true }).metadata(); assert.equal(metadata.width, 1600); assert.equal(metadata.pageHeight, 96); assert.equal(metadata.pages, 2);
});
