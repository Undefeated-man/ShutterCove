'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { spawn } = require('node:child_process');
const core = require('../app/updater-core.cjs');
const { UpdateService, waitForBootReady } = require('../app/updater.cjs');
const helper = require('../app/updater-helper.cjs');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), '.shiguang-updater-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
function release(version = '1.0.7', filename = `Shiguang-Isle-${version}-mac-arm64.zip`, bytes = Buffer.from('payload')) {
  const sums = Buffer.from(`${digest(bytes)}  ${filename}\n`);
  const asset = (name, data) => ({ name, state: 'uploaded', size: data.length, digest: `sha256:${digest(data)}`, browser_download_url: `https://github.com/Undefeated-man/shiguang-isle/releases/download/v${version}/${encodeURIComponent(name)}` });
  return { tag_name: `v${version}`, draft: false, prerelease: false, assets: [asset(filename, bytes), asset('SHA256SUMS.txt', sums)], bytes, sums };
}
function requestFixture(body, { statusCode = 200, headers = {}, never = false } = {}) {
  return (_url, _options, callback) => {
    const request = new EventEmitter(); request.setTimeout = () => {};
    request.end = () => queueMicrotask(() => { if (!never) { const response = Readable.from([body]); response.statusCode = statusCode; response.headers = headers; callback(response); } });
    request.destroy = error => queueMicrotask(() => request.emit('error', error));
    return request;
  };
}
function zipBytes(entries) {
  const local = [], central = []; let offset = 0;
  for (const { name, data = '', mode = 0o100644 } of entries) {
    const filename = Buffer.from(name), body = Buffer.from(data), header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(body.length, 22); header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, body);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(0x0314, 4); directory.writeUInt16LE(20, 6); directory.writeUInt32LE(body.length, 20); directory.writeUInt32LE(body.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE((mode << 16) >>> 0, 38); directory.writeUInt32LE(offset, 42);
    central.push(directory, filename); offset += header.length + filename.length + body.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
function appImageBytes(arch = 'x64') {
  const bytes = Buffer.alloc(64); Buffer.from([0x7f, 0x45, 0x4c, 0x46]).copy(bytes); bytes[4] = 2; bytes[5] = 1; bytes[8] = 0x41; bytes[9] = 0x49; bytes[10] = 2; bytes.writeUInt16LE(arch === 'arm64' ? 183 : 62, 18); return bytes;
}
async function jobFixture(t) {
  const root = await fixture(t), userData = path.join(root, 'profile'); await fs.mkdir(userData);
  const job = { platform: 'linux', arch: 'x64', target: path.join(root, '拾光屿.AppImage'), stagingRoot: path.join(root, '.shiguang-update-test.noindex'), backupRoot: path.join(root, '.shiguang-backup-test.noindex'), workRoot: path.join(userData, '.updates.noindex', '.job'), userData, token: 'a'.repeat(48), version: '1.0.7', parentPid: process.pid };
  await fs.mkdir(job.stagingRoot); await fs.mkdir(job.workRoot, { recursive: true });
  job.staged = path.join(job.stagingRoot, 'payload'); job.resultFile = path.join(userData, '.update-result.json'); job.pendingFile = path.join(userData, '.update-pending.json'); job.launchMarker = path.join(job.workRoot, '.launched.json');
  await fs.writeFile(job.target, 'old'); await fs.writeFile(job.staged, 'new'); await fs.writeFile(path.join(userData, 'settings.json'), '{"checkUpdatesAutomatically":false}'); await fs.writeFile(path.join(userData, 'library.json'), '{"favorites":["private-id"]}');
  job.metadataBackup = await core.backupMetadata(userData, '1.0.6');
  return job;
}
async function downloadedFixture(t) {
  const root = await fixture(t), image = path.join(root, '拾光屿.AppImage'); await fs.writeFile(image, appImageBytes(), { mode: 0o755 });
  const payload = Buffer.concat([appImageBytes(), Buffer.from('new release')]), published = release('1.0.7', 'Shiguang-Isle-1.0.7-linux-x86_64.AppImage', payload), app = { isPackaged: true, getVersion: () => '1.0.6', getPath: name => name === 'home' ? root : path.join(root, 'profile') };
  let requests = 0;
  const options = { app, platform: 'linux', arch: 'x64', appImage: image, transport: async (url, options) => {
    requests++;
    if (url === core.RELEASE_API) return { data: Buffer.from(JSON.stringify(published)) };
    if (url.endsWith('SHA256SUMS.txt')) return { data: published.sums, sha256: digest(published.sums) };
    await fs.writeFile(options.file, payload, { mode: 0o600 }); return { sha256: digest(payload), size: payload.length };
  } };
  const service = new UpdateService(options); await service.init(); t.after(() => service.stop()); await service.checkForUpdates(); assert.equal((await service.downloadUpdate()).status, 'ready');
  return { root, app, service, options, requests: () => requests, payload };
}

test('stable semver compares numerically and rejects prerelease, padding and invalid integers', () => {
  assert.equal(core.newerVersion('1.10.0', '1.9.9'), true);
  assert.equal(core.newerVersion('2.0.0', '1.99.99'), true);
  for (const version of ['1.0.6', '1.0.5', '1.0.7-beta.1', '01.0.7', '1.0.7+build', '1.0.9007199254740992']) assert.equal(core.newerVersion(version, '1.0.6'), false);
});
test('release selection binds stable version, architecture, exact filename and repository', () => {
  const selected = core.selectRelease(release(), '1.0.6', 'darwin', 'arm64'); assert.equal(selected.version, '1.0.7');
  assert.equal(core.selectRelease(release('1.0.5'), '1.0.6', 'darwin', 'arm64').newer, false);
  for (const patch of [{ draft: true }, { prerelease: true }, { tag_name: 'v1.0.7-beta' }]) assert.throws(() => core.selectRelease({ ...release(), ...patch }, '1.0.6', 'darwin', 'arm64'));
  assert.throws(() => core.selectRelease(release(), '1.0.6', 'darwin', 'x64'));
  const bad = release(); bad.assets[0].browser_download_url = bad.assets[0].browser_download_url.replace('Undefeated-man', 'attacker'); assert.throws(() => core.selectRelease(bad, '1.0.6', 'darwin', 'arm64'));
  assert.equal(core.selectRelease(release('1.0.7', 'Shiguang-Isle-1.0.7-linux-x86_64.AppImage'), '1.0.6', 'linux', 'x64').asset.name.endsWith('x86_64.AppImage'), true);
  assert.equal(core.selectRelease(release('1.0.7', 'Shiguang-Isle-1.0.7-linux-amd64.deb'), '1.0.6', 'linux', 'x64', 'deb').asset.name.endsWith('amd64.deb'), true);
});
test('trusted HTTPS origins reject credentials, foreign redirects, HTTP and altered API', () => {
  for (const url of ['http://github.com/a', 'https://github.com.evil.test/a', 'https://user@github.com/a', 'https://github.com:444/a', 'https://github.com/a#fragment', 'https://evil.test/a']) assert.throws(() => core.trustedURL(url));
  assert.equal(core.trustedURL('https://release-assets.githubusercontent.com/file?signed=value').hostname, 'release-assets.githubusercontent.com');
  assert.throws(() => core.trustedURL(`${core.RELEASE_API}?private=1`, 'api'));
});
test('checksum requires one exact filename and agreement with the GitHub asset digest', () => {
  const hash = digest('payload'); assert.equal(core.checksumFor(`${hash}  file.zip\n`, 'file.zip', `sha256:${hash}`), hash);
  for (const sums of [`${hash}  other.zip`, `${hash}  file.zip\n${hash}  file.zip`, `${'0'.repeat(64)}  file.zip`]) assert.throws(() => core.checksumFor(sums, 'file.zip', `sha256:${hash}`));
});
test('bounded streaming download writes complete bytes, hashes them and rejects truncation/size overflow', async t => {
  const root = await fixture(t), body = Buffer.from('complete streamed bytes'), file = path.join(root, 'download.part');
  const result = await core.transfer('https://github.com/file', { file, expectedSize: body.length, request: requestFixture(body) });
  assert.deepEqual(await fs.readFile(file), body); assert.equal(result.sha256, digest(body));
  await assert.rejects(core.transfer('https://github.com/file', { expectedSize: body.length + 1, request: requestFixture(body) }), /不完整/);
  await assert.rejects(core.transfer('https://github.com/file', { maxBytes: 2, request: requestFixture(body) }), /超出/);
});
test('requests have an absolute timeout and redirects cannot escape the allowlist', async () => {
  await assert.rejects(core.transfer('https://github.com/file', { timeoutMs: 20, request: requestFixture(Buffer.alloc(0), { never: true }) }), /超时/);
  await assert.rejects(core.transfer('https://github.com/file', { request: requestFixture(Buffer.alloc(0), { statusCode: 302, headers: { location: 'https://attacker.test/payload' } }) }), /未授权/);
});
test('ZIP traversal, duplicate names and escaping symlink chains are rejected before extraction', async t => {
  const root = await fixture(t), file = path.join(root, 'payload.zip');
  const unsafe = [
    [{ name: '../outside' }], [{ name: 'App.app/../outside' }], [{ name: 'App.app/x' }, { name: 'App.app/x' }],
    [{ name: 'App.app/link', mode: 0o120777, data: '../../outside' }],
    [{ name: 'App.app/a', mode: 0o120777, data: 'b' }, { name: 'App.app/b', mode: 0o120777, data: 'a' }],
    [{ name: 'App.app//x' }], [{ name: 'App.app/x', mode: 0o020666 }]
  ];
  for (const entries of unsafe) { await fs.writeFile(file, zipBytes(entries)); await assert.rejects(core.inspectZip(file)); }
});
test('normal Electron Framework relative symlinks remain inside one ZIP bundle', async t => {
  const root = await fixture(t), file = path.join(root, 'payload.zip');
  await fs.writeFile(file, zipBytes([{ name: 'App.app/Contents/Frameworks/F.framework/Versions/A/F', data: 'binary' }, { name: 'App.app/Contents/Frameworks/F.framework/Versions/Current', mode: 0o120777, data: 'A' }, { name: 'App.app/Contents/Frameworks/F.framework/F', mode: 0o120777, data: 'Versions/Current/F' }]));
  assert.equal(await core.inspectZip(file), 'App.app');
});
test('post-extraction tree validation accepts internal links and rejects external symlinks', async t => {
  const root = await fixture(t), bundle = path.join(root, 'App.app'); await fs.mkdir(bundle); await fs.writeFile(path.join(bundle, 'binary'), 'safe'); await fs.symlink('binary', path.join(bundle, 'link')); await core.validateTree(bundle);
  await fs.writeFile(path.join(root, 'private'), 'private'); await fs.symlink('../private', path.join(bundle, 'escape')); await assert.rejects(core.validateTree(bundle), /外部/);
});
test('Mac target must be a real app installed directly in Applications; AppImage must be writable and real', async t => {
  const root = await fixture(t), apps = path.join(root, 'Applications'), bundle = path.join(apps, '拾光屿.app'); await fs.mkdir(path.join(bundle, 'Contents', 'MacOS'), { recursive: true });
  const installed = await core.detectInstallation({ packaged: true, platform: 'darwin', execPath: path.join(bundle, 'Contents', 'MacOS', 'Shiguang Isle'), home: root }); assert.equal(installed.installSupported, true); assert.equal(installed.target, bundle);
  const download = await core.detectInstallation({ packaged: true, platform: 'darwin', execPath: path.join(root, 'Downloads', 'App.app', 'Contents', 'MacOS', 'App'), home: root }); assert.equal(download.installSupported, false);
  const image = path.join(root, 'AppImage'); await fs.writeFile(image, appImageBytes(), { mode: 0o755 }); await core.validateAppImage(image, 'x64'); await assert.rejects(core.validateAppImage(image, 'arm64'));
  const linked = path.join(root, 'linked'); await fs.symlink(image, linked); assert.equal((await core.detectInstallation({ packaged: true, platform: 'linux', appImage: linked, home: root })).installSupported, false);
});
test('metadata backup preserves settings/library bytes and excludes photos/cache', async t => {
  const root = await fixture(t), original = Buffer.from('{"privateLibraryPath":"kept locally","favorite":true}');
  await fs.writeFile(path.join(root, 'settings.json'), original); await fs.writeFile(path.join(root, 'library.json'), original); await fs.mkdir(path.join(root, 'previews')); await fs.writeFile(path.join(root, 'previews', 'photo.jpg'), 'private');
  const backup = await core.backupMetadata(root, '1.0.6'); assert.deepEqual((await fs.readdir(backup)).sort(), ['library.json', 'settings.json']); assert.deepEqual(await fs.readFile(path.join(backup, 'library.json')), original); assert.equal((await fs.stat(path.join(backup, 'library.json'))).mode & 0o777, 0o600);
});
test('wrong downloaded checksum clears partial data and leaves the current AppImage untouched', async t => {
  const root = await fixture(t), image = path.join(root, 'AppImage'); await fs.writeFile(image, appImageBytes(), { mode: 0o755 });
  const publish = release('1.0.7', 'Shiguang-Isle-1.0.7-linux-x86_64.AppImage', appImageBytes()), app = { isPackaged: true, getVersion: () => '1.0.6', getPath: name => name === 'home' ? root : path.join(root, 'profile') };
  const service = new UpdateService({ app, platform: 'linux', arch: 'x64', appImage: image, transport: async (url, options) => {
    if (url === core.RELEASE_API) return { data: Buffer.from(JSON.stringify(publish)) };
    if (url.endsWith('SHA256SUMS.txt')) return { data: publish.sums, sha256: digest(publish.sums) };
    await fs.writeFile(options.file, 'bad download'); return { sha256: digest('bad download'), size: 12 };
  } }); t.after(() => service.stop()); await service.init(); assert.equal((await service.checkForUpdates()).status, 'available'); assert.equal((await service.downloadUpdate()).status, 'error');
  assert.deepEqual(await fs.readFile(image), appImageBytes()); assert.deepEqual(await fs.readdir(path.join(app.getPath('userData'), '.updates.noindex')), []);
});
test('demo/smoke never request the network; automatic preference and persisted 24h rate limit apply', async t => {
  const root = await fixture(t), app = { isPackaged: false, getVersion: () => '1.0.6', getPath: () => root }; let requests = 0;
  const disabled = new UpdateService({ app, disabled: true, transport: async () => { requests++; } }); await disabled.init(); await disabled.checkForUpdates(); await disabled.downloadUpdate(); disabled.stop(); assert.equal(requests, 0);
  const automatic = new UpdateService({ app, automatic: () => false, transport: async () => { requests++; } }); await automatic.init(); await automatic.automaticCheck(); assert.equal(requests, 0); automatic.automatic = () => true; automatic.record.lastChecked = Date.now(); await automatic.automaticCheck(); assert.equal(requests, 0); automatic.stop();
});
test('successful in-place transaction preserves Chinese name and metadata and removes app backups/staging', async t => {
  const job = await jobFixture(t), before = await fs.readFile(path.join(job.userData, 'library.json'));
  const result = await helper.transactionalReplace(job, { launchNew: async () => assert.equal(await fs.readFile(job.target, 'utf8'), 'new') }); assert.equal(result.updated, true); assert.equal(await fs.readFile(job.target, 'utf8'), 'new'); assert.deepEqual(await fs.readFile(path.join(job.userData, 'library.json')), before);
  for (const directory of [job.backupRoot, job.stagingRoot, job.workRoot]) await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
});
test('failure between rename operations rolls back in place and keeps library metadata', async t => {
  const job = await jobFixture(t); let calls = 0, reopened = false;
  const result = await helper.transactionalReplace(job, { rename: async (...args) => { if (++calls === 2) throw new Error('synthetic rename failure'); await fs.rename(...args); }, launchOld: async () => { reopened = true; } });
  assert.equal(result.restored, true); assert.equal(reopened, true); assert.equal(await fs.readFile(job.target, 'utf8'), 'old'); assert.equal(JSON.parse(await fs.readFile(path.join(job.userData, 'library.json'))).favorites[0], 'private-id');
});
test('failed startup restores both original app and metadata before reopening', async t => {
  const job = await jobFixture(t); let reopened = false;
  const result = await helper.transactionalReplace(job, { launchNew: async () => { await fs.writeFile(path.join(job.userData, 'library.json'), 'changed during failed start'); throw new Error('missing acknowledgment'); }, launchOld: async () => { reopened = true; assert.equal(await fs.readFile(job.target, 'utf8'), 'old'); } });
  assert.equal(result.restored, true); assert.equal(reopened, true); assert.equal(JSON.parse(await fs.readFile(path.join(job.userData, 'library.json'))).favorites[0], 'private-id');
});
test('launch acknowledgment binds nonce/version/path and a timed-out child is terminated before rollback', async t => {
  const job = await jobFixture(t); await fs.writeFile(job.launchMarker, JSON.stringify({ token: 'wrong', version: job.version, target: job.target })); await assert.rejects(helper.waitForLaunch(job, 10), /未能完成启动/);
  await fs.writeFile(job.launchMarker, JSON.stringify({ token: job.token, version: job.version, target: job.target })); await helper.waitForLaunch(job, 10);
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); await new Promise(resolve => child.once('spawn', resolve)); await helper.stopLaunchedChild(child); assert.ok(child.exitCode !== null || child.signalCode !== null);
});
test('helper job refuses renderer-like arbitrary paths and untrusted relaunch receipts', async t => {
  const job = await jobFixture(t); helper.validateJob(job); assert.throws(() => helper.validateJob({ ...job, staged: '/tmp/foreign' })); assert.throws(() => helper.validateJob({ ...job, launchMarker: '/tmp/arbitrary-write' }));
  const app = { isPackaged: false, getVersion: () => '1.0.7', getPath: () => job.userData }, service = new UpdateService({ app, disabled: true }); await service.init();
  await fs.writeFile(job.pendingFile, JSON.stringify({ token: job.token, version: '1.0.7', target: '/wrong', workRoot: job.workRoot, launchMarker: job.launchMarker })); await service.acknowledgeRelaunch(job.token); await assert.rejects(fs.stat(job.launchMarker), { code: 'ENOENT' }); service.stop();
});
test('installation preparation failure preserves verified payload and supports ready retry', async t => {
  const root = await fixture(t), image = path.join(root, 'AppImage'), staged = path.join(root, 'verified-payload'); await fs.writeFile(image, appImageBytes(), { mode: 0o755 }); await fs.writeFile(staged, appImageBytes()); let failures = 0;
  const app = { isPackaged: true, getVersion: () => '1.0.6', getPath: name => name === 'home' ? root : path.join(root, 'profile') };
  const service = new UpdateService({ app, platform: 'linux', arch: 'x64', appImage: image, beforeInstall: async () => { throw new Error('请等待照片处理结束后再更新'); }, installFailed: () => { failures++; } }); await service.init(); t.after(() => service.stop());
  service.ready = { staged, format: 'appimage', sha256: digest(appImageBytes()), version: '1.0.7' };
  assert.equal((await service.installUpdate()).status, 'error'); assert.equal(failures, 1); assert.equal(service.ready.staged, staged); assert.deepEqual(await fs.readFile(staged), appImageBytes()); assert.equal((await service.downloadUpdate()).status, 'ready');
});
test('cleanup failure after acknowledged launch never rolls back a healthy new version', async t => {
  const job = await jobFixture(t); await fs.mkdir(job.resultFile);
  const result = await helper.transactionalReplace(job, { launchNew: async () => {} });
  assert.equal(result.updated, true); assert.equal(result.cleanupPending, true); assert.equal(await fs.readFile(job.target, 'utf8'), 'new'); assert.equal(await fs.readFile(path.join(job.backupRoot, path.basename(job.target)), 'utf8'), 'old');
});
test('basic boot acknowledgment waits for exact ready flag and never acknowledges failed settings IPC', async () => {
  let ready = false; const timer = setTimeout(() => { ready = true; }, 15);
  assert.equal(await waitForBootReady(() => ready, { timeoutMs: 80, intervalMs: 5 }), true); clearTimeout(timer);
  assert.equal(await waitForBootReady(() => ({ appExists: true, navigationExists: true }), { timeoutMs: 15, intervalMs: 5 }), false);
  assert.equal(await waitForBootReady(() => { throw new Error('settings IPC failed'); }, { timeoutMs: 15, intervalMs: 5 }), false);
});
test('verified ready download survives restart and is rehashed without another HTTP request', async t => {
  const fixture = await downloadedFixture(t), original = fixture.service.ready; fixture.service.stop(); const requests = fixture.requests();
  const restored = new UpdateService(fixture.options); await restored.init(); t.after(() => restored.stop());
  assert.equal(restored.snapshot().status, 'ready'); assert.equal(restored.ready.staged, original.staged); assert.equal(restored.snapshot().latestVersion, '1.0.7'); assert.equal(fixture.requests(), requests); assert.equal((await restored.downloadUpdate()).status, 'ready');
});
test('tampered ready payload is discarded on restart, including owned stage and ZIP/download directory', async t => {
  const fixture = await downloadedFixture(t), old = fixture.service.ready; fixture.service.stop(); await fs.writeFile(old.downloaded, 'tampered');
  const restored = new UpdateService(fixture.options); await restored.init(); t.after(() => restored.stop()); assert.equal(restored.ready, null);
  for (const file of [restored.readyFile, old.stagingRoot, old.workRoot]) await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});
test('startup removes owned orphan partial downloads/stages while preserving foreign stages and rollback backups', async t => {
  const root = await fixture(t), image = path.join(root, 'AppImage'), userData = path.join(root, 'profile'), work = path.join(userData, '.updates.noindex', '.1.0.5-orphan123'); await fs.writeFile(image, appImageBytes(), { mode: 0o755 }); await fs.mkdir(work, { recursive: true }); await fs.writeFile(path.join(work, 'payload.part'), 'interrupted');
  const stage = path.join(root, `.shiguang-update-${'a'.repeat(24)}.noindex`), foreign = path.join(root, `.shiguang-update-${'b'.repeat(24)}.noindex`), backup = path.join(root, `.shiguang-backup-${'c'.repeat(24)}.noindex`);
  for (const directory of [stage, foreign, backup]) await fs.mkdir(directory); await core.atomicJSON(path.join(stage, '.owner.json'), { userData, workRoot: work, target: image }); await core.atomicJSON(path.join(foreign, '.owner.json'), { userData: '/foreign/profile', workRoot: work }); await fs.writeFile(path.join(backup, 'original.app'), 'recoverable');
  const service = new UpdateService({ app: { isPackaged: true, getVersion: () => '1.0.6', getPath: name => name === 'home' ? root : userData }, platform: 'linux', arch: 'x64', appImage: image }); await service.init(); t.after(() => service.stop());
  for (const directory of [stage, work]) await assert.rejects(fs.stat(directory), { code: 'ENOENT' }); assert.ok((await fs.stat(foreign)).isDirectory()); assert.equal(await fs.readFile(path.join(backup, 'original.app'), 'utf8'), 'recoverable');
});
test('active helper and retained rollback backup protect ready/staging paths from startup cleanup', async t => {
  const fixture = await downloadedFixture(t), ready = fixture.service.ready, userData = fixture.app.getPath('userData'); fixture.service.stop();
  const job = { platform: 'linux', arch: 'x64', parentPid: process.pid, target: ready.target, staged: ready.staged, stagingRoot: ready.stagingRoot, backupRoot: path.join(fixture.root, `.shiguang-backup-${ready.suffix}.noindex`), workRoot: ready.workRoot, userData, metadataBackup: await core.backupMetadata(userData, '1.0.6'), token: 'a'.repeat(48), version: '1.0.7', resultFile: path.join(userData, '.update-result.json'), pendingFile: path.join(userData, '.update-pending.json'), launchMarker: path.join(ready.workRoot, '.launched.json'), readyFile: fixture.service.readyFile };
  await core.atomicJSON(path.join(ready.workRoot, '.job.json'), job); await core.atomicJSON(job.pendingFile, { token: job.token, workRoot: job.workRoot, helperPid: process.pid });
  const restarted = new UpdateService(fixture.options); await restarted.init(); t.after(() => restarted.stop()); assert.ok((await fs.stat(ready.staged)).isFile()); assert.equal((await restarted.downloadUpdate()).status, 'error');
  await fs.mkdir(job.backupRoot); await fs.writeFile(path.join(job.backupRoot, 'original'), 'rollback'); await core.atomicJSON(job.pendingFile, { token: job.token, workRoot: job.workRoot, helperPid: 2147483647 });
  const afterCrash = new UpdateService(fixture.options); await afterCrash.init(); t.after(() => afterCrash.stop()); assert.ok((await fs.stat(ready.workRoot)).isDirectory()); assert.equal(await fs.readFile(path.join(job.backupRoot, 'original'), 'utf8'), 'rollback');
});
test('metadata backups retain three generated backups and leave unrelated user directories alone', async t => {
  const root = await fixture(t); await fs.writeFile(path.join(root, 'settings.json'), '{}'); await fs.writeFile(path.join(root, 'library.json'), '{}'); const base = path.join(root, '.update-metadata-backups.noindex'); await fs.mkdir(base); await fs.mkdir(path.join(base, 'unrelated'));
  for (let i = 0; i < 5; i++) await core.backupMetadata(root, `1.0.${i}`);
  assert.equal((await fs.readdir(base)).filter(name => name.startsWith('.')).length, 3); assert.ok((await fs.stat(path.join(base, 'unrelated'))).isDirectory());
});
test('packaged linux-unpacked binaries do not masquerade as installed deb packages', async t => {
  const root = await fixture(t), unpacked = path.join(root, 'dist', 'linux-unpacked', 'shiguang-isle'); await fs.mkdir(path.dirname(unpacked), { recursive: true }); await fs.writeFile(unpacked, 'fixture executable', { mode: 0o755 });
  const installation = await core.detectInstallation({ packaged: true, platform: 'linux', execPath: unpacked, home: root }); assert.equal(installation.support, 'manual'); assert.equal(installation.installSupported, false);
});
