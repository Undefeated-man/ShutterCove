'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
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
  const asset = (name, data) => ({ name, state: 'uploaded', size: data.length, digest: `sha256:${digest(data)}`, browser_download_url: `https://github.com/Undefeated-man/ShutterCove/releases/download/v${version}/${encodeURIComponent(name)}` });
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
  const options = { autoInstallEnabled: () => false, app, platform: 'linux', arch: 'x64', appImage: image, transport: async (url, options) => {
    requests++;
    if (url === core.RELEASE_API) return { data: Buffer.from(JSON.stringify(published)) };
    if (url.endsWith('SHA256SUMS.txt')) return { data: published.sums, sha256: digest(published.sums) };
    await fs.writeFile(options.file, payload, { mode: 0o600 }); return { sha256: digest(payload), size: payload.length };
  } };
  const service = new UpdateService(options); await service.init(); t.after(() => service.stop()); await service.checkForUpdates(); assert.equal((await service.downloadUpdate()).status, 'ready');
  return { root, app, service, options, requests: () => requests, payload };
}
async function completedFixture(t) {
  const fixture = await downloadedFixture(t), ready = fixture.service.ready, userData = fixture.app.getPath('userData'); fixture.service.stop();
  const job = { platform: 'linux', arch: 'x64', parentPid: process.pid, target: ready.target, staged: ready.staged, stagingRoot: ready.stagingRoot, backupRoot: path.join(fixture.root, `.shiguang-backup-${ready.suffix}.noindex`), workRoot: ready.workRoot, userData, metadataBackup: await core.backupMetadata(userData, '1.0.6'), token: 'a'.repeat(48), version: '1.0.7', sha256: ready.sha256, resultFile: path.join(userData, '.update-result.json'), pendingFile: path.join(userData, '.update-pending.json'), launchMarker: path.join(ready.workRoot, '.launched.json'), readyFile: fixture.service.readyFile };
  await fs.mkdir(job.backupRoot); await fs.copyFile(job.target, path.join(job.backupRoot, path.basename(job.target))); await fs.rename(job.staged, job.target);
  await core.atomicJSON(path.join(job.workRoot, '.job.json'), job);
  await core.atomicJSON(job.pendingFile, { token: job.token, version: job.version, target: job.target, launchMarker: job.launchMarker, workRoot: job.workRoot, helperPid: 2147483647 });
  await core.atomicJSON(job.launchMarker, { token: job.token, version: job.version, target: job.target });
  // v1.0.7's completed result had no token/target, so the matching private
  // pending job and launch receipt provide that compatibility evidence.
  await core.atomicJSON(job.resultFile, { status: 'completed', version: job.version, message: 'temporary files retained' });
  const service = new UpdateService({ ...fixture.options, app: { ...fixture.app, getVersion: () => '1.0.7' } }); await service.init(); t.after(() => service.stop());
  return { ...fixture, service, job };
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
  const previousRepository = release(); previousRepository.assets[0].browser_download_url = previousRepository.assets[0].browser_download_url.replace('/ShutterCove/', '/shiguang-isle/'); assert.throws(() => core.selectRelease(previousRepository, '1.0.6', 'darwin', 'arm64'));
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
  const service = new UpdateService({ autoInstallEnabled: () => false, app, platform: 'linux', arch: 'x64', appImage: image, transport: async (url, options) => {
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
test('automatic check downloads and validates once, defers while working, and requires a full idle grace period', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  await service.discardReady(); service.record.lastChecked = 0;
  let safe = false, clock = Date.now(), installs = 0;
  service.canInstall = () => safe; service.now = () => clock;
  service.installUpdate = async options => { assert.equal(options.automatic, true); installs++; service.stop(); return service.set({ status: 'installing' }); };
  const before = fixture.requests();
  await service.automaticCheck();
  assert.equal(fixture.requests(), before + 3); assert.equal(service.ready.automatic, true);
  assert.equal(service.snapshot().autoDeferred, true); assert.equal(installs, 0);
  assert.deepEqual(await fs.readFile(service.ready.downloaded), fixture.payload);
  await service.automaticCheck(); assert.equal(fixture.requests(), before + 3);
  safe = true; await service.resumeAutomatic();
  const firstDeadline = service.snapshot().autoRestartAt;
  assert.equal(firstDeadline, clock + 10_000); clock += 9000; await service.resumeAutomatic(); assert.equal(installs, 0);
  safe = false; await service.resumeAutomatic(); assert.equal(service.snapshot().autoRestartAt, null);
  clock += 1000; safe = true; await service.resumeAutomatic();
  assert.equal(service.snapshot().autoRestartAt, clock + 10_000); assert.ok(service.snapshot().autoRestartAt > firstDeadline);
  clock += 10_000; await service.resumeAutomatic(); assert.equal(installs, 1); assert.equal(fixture.requests(), before + 3);
});
test('turning automatic updates off during download leaves a verified manual download without restarting', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  await service.discardReady(); service.record.lastChecked = 0;
  let enabled = true, resolveDownload, startedDownload;
  const reachedDownload = new Promise(resolve => { startedDownload = resolve; });
  const gate = new Promise(resolve => { resolveDownload = resolve; });
  const transport = service.transport;
  service.autoInstallEnabled = () => enabled; service.canInstall = () => true;
  service.transport = async (url, options) => { if (options.file) { startedDownload(); await gate; } return transport(url, options); };
  let installs = 0; service.installUpdate = async () => { installs++; };
  const pipeline = service.automaticCheck(); await reachedDownload;
  enabled = false; service.automaticPreferencesChanged(); resolveDownload(); await pipeline;
  assert.equal(service.snapshot().status, 'ready'); assert.equal(service.snapshot().automaticUpdate, false);
  assert.equal(service.snapshot().autoRestartAt, null); assert.equal(installs, 0);
  assert.deepEqual(await fs.readFile(service.ready.downloaded), fixture.payload);
  await service.resumeAutomatic(); assert.equal(installs, 0);
  enabled = true; await service.resumeAutomatic(); assert.ok(service.snapshot().autoRestartAt);
});
test('closing settings does not erase automatic intent; restart reuses the verified payload and preserves manual download-only intent', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  // The manual download produced by the fixture must remain manual.
  service.canInstall = () => true; let installs = 0;
  service.installUpdate = async () => { installs++; }; await service.resumeAutomatic();
  assert.equal(installs, 0); assert.equal(service.ready.automatic, false);
  await service.discardReady(); service.record.lastChecked = 0; service.canInstall = () => false;
  await service.automaticCheck(); const ready = service.ready, requests = fixture.requests(); service.stop();
  const restored = new UpdateService({ ...fixture.options, autoInstallEnabled: () => true, canInstall: () => false }); await restored.init(); t.after(() => restored.stop());
  await restored.automaticCheck();
  assert.equal(restored.ready.automatic, true); assert.equal(restored.ready.staged, ready.staged);
  assert.equal(restored.snapshot().autoDeferred, true); assert.equal(fixture.requests(), requests);
});
test('automatic failures and rollback retries do not create an install loop for the same release', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  service.ready.automatic = true; service.canInstall = () => true;
  let attempts = 0;
  service.beforeInstall = async () => { attempts++; throw new Error('合成更新准备失败'); };
  assert.equal((await service.installUpdate({ automatic: true })).status, 'error');
  assert.equal(service.record.autoInstallAttemptedVersion, '1.0.7'); assert.equal(attempts, 1);
  const record = JSON.parse(await fs.readFile(service.recordFile, 'utf8')); assert.equal(record.autoInstallAttemptedVersion, '1.0.7');
  await service.installUpdate({ automatic: true }); await service.resumeAutomatic(); assert.equal(attempts, 1);
  service.stop();
  await core.atomicJSON(service.readyFile, { ...service.ready, automatic: true });
  const restored = new UpdateService({ ...fixture.options, autoInstallEnabled: () => true, canInstall: () => true, beforeInstall: service.beforeInstall }); await restored.init(); t.after(() => restored.stop());
  await restored.resumeAutomatic(); assert.equal(attempts, 1); assert.equal(restored.snapshot().automaticUpdate, false);
  // A deliberate manual retry is still available; the automatic guard only
  // suppresses background installation of the same failing version.
  await restored.installUpdate(); assert.equal(attempts, 2);
});
test('final install handshake racing with a photo task safely defers without recording a failed attempt', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  service.ready.automatic = true; service.canInstall = () => true;
  let attempts = 0;
  service.beforeInstall = async ({ automatic }) => { assert.equal(automatic, true); attempts++; const error = new Error('请等待当前照片任务完成'); error.code = 'UPDATE_BUSY'; throw error; };
  const result = await service.installUpdate({ automatic: true });
  assert.equal(result.status, 'ready'); assert.equal(result.autoDeferred, true); assert.equal(attempts, 1);
  assert.equal(service.record.autoInstallAttemptedVersion, undefined);
  assert.deepEqual(await fs.readFile(service.ready.downloaded), fixture.payload);
});
test('missing or failed renderer handshake, disabled preference and unsupported deb never silently restart', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  service.ready.automatic = true; service.autoInstallEnabled = () => false;
  await service.installUpdate({ automatic: true }); assert.notEqual(service.snapshot().status, 'installing');
  service.autoInstallEnabled = () => true;
  await service.resumeAutomatic(); assert.equal(service.snapshot().autoDeferred, true);
  service.canInstall = () => { throw new Error('renderer unavailable'); }; await service.resumeAutomatic(); assert.equal(service.snapshot().autoDeferred, true);
  service.installation.support = 'deb'; let systemInstallers = 0; service.openInstaller = () => { systemInstallers++; };
  await service.resumeAutomatic(); await service.installUpdate({ automatic: true }); assert.equal(systemInstallers, 0);
});
test('automatic checksum failure drops the partial file and does not repeatedly redownload the same candidate', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service; service.autoInstallEnabled = () => true;
  await service.discardReady(); service.record.lastChecked = 0;
  const transport = service.transport; service.transport = async (url, options) => {
    const result = await transport(url, options); return options.file ? { ...result, sha256: '0'.repeat(64) } : result;
  };
  await service.automaticCheck(); assert.equal(service.snapshot().status, 'error'); assert.equal(service.ready, null);
  assert.equal(service.record.autoDownloadFailedVersion, '1.0.7');
  assert.deepEqual(await fs.readdir(service.updateBase), []);
  const requests = fixture.requests(); service.record.lastChecked = 0; await service.automaticCheck();
  assert.equal(fixture.requests(), requests + 1); assert.equal(service.ready, null);
});
test('manual check queues an automatic download, while an explicit download-only request wins the asynchronous reservation', async t => {
  const fixture = await downloadedFixture(t), service = fixture.service;
  await service.discardReady(); service.autoInstallEnabled = () => true;
  await service.checkForUpdates();
  for (let retry = 0; retry < 200 && !service.ready; retry++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(service.ready?.automatic, true); assert.deepEqual(await fs.readFile(service.ready.downloaded), fixture.payload);
  await service.discardReady();
  await service.checkForUpdates();
  const downloading = service.downloadUpdate();
  await service.resumeAutomatic(); await downloading;
  assert.equal(service.ready.automatic, false); assert.equal(service.snapshot().autoRestartAt, null);
  await service.resumeAutomatic(); assert.equal(service.snapshot().autoRestartAt, null);
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
test('physical cleanup removes real ASAR archives in Electron Node without disabling live ASAR reads', async t => {
  const root = await fixture(t), source = path.join(root, 'source'), resources = path.join(root, 'Old.app', 'Contents', 'Resources'), live = path.join(root, 'Live.app', 'Contents', 'Resources');
  await fs.mkdir(source); await fs.writeFile(path.join(source, 'sentinel.txt'), 'live archive'); await fs.mkdir(resources, { recursive: true }); await fs.mkdir(live, { recursive: true });
  await require('@electron/asar').createPackage(source, path.join(resources, 'app.asar')); await fs.copyFile(path.join(resources, 'app.asar'), path.join(live, 'app.asar'));
  const script = path.join(root, 'electron-cleanup.cjs');
  await fs.writeFile(script, `const assert = require('node:assert/strict'); const fs = require('node:fs/promises'); const core = require(${JSON.stringify(require.resolve('../app/updater-core.cjs'))}); (async () => { const old = ${JSON.stringify(path.join(root, 'Old.app'))}; let code; try { await fs.rm(old, { recursive:true, force:true }); } catch (error) { code = error.code; } assert.equal(code, 'ENOTEMPTY'); await core.removePhysical(old, { recursive:true, force:true }); await assert.rejects(fs.stat(old), {code:'ENOENT'}); assert.equal(await fs.readFile(${JSON.stringify(path.join(live, 'app.asar', 'sentinel.txt'))}, 'utf8'), 'live archive'); assert.notEqual(process.noAsar, true); console.log('physical-asar-cleanup-passed'); })().catch(error => { console.error(error); process.exitCode = 1; });`);
  const result = await run(require('electron'), [script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 20_000 });
  assert.match(result.stdout, /physical-asar-cleanup-passed/);
});
test('post-boot recovery cleans a confirmed completed old-helper job after its helper exits', async t => {
  const { service, job } = await completedFixture(t), before = await fs.readFile(job.target), metadata = await fs.readFile(path.join(job.metadataBackup, 'settings.json')).catch(() => null);
  assert.equal((await service.reconcileCompletedUpdate()).recovered, true);
  for (const file of [job.backupRoot, job.stagingRoot, job.workRoot, job.pendingFile, job.readyFile]) await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  assert.deepEqual(await fs.readFile(job.target), before); assert.ok((await fs.stat(job.metadataBackup)).isDirectory()); if (metadata) assert.deepEqual(await fs.readFile(path.join(job.metadataBackup, 'settings.json')), metadata);
  const result = JSON.parse(await fs.readFile(job.resultFile)); assert.equal(result.status, 'completed'); assert.equal(result.cleanupRecovered, true);
});
test('post-boot cleanup preserves active-helper, failed, mismatched and unsafe recovery evidence', async t => {
  for (const scenario of ['active', 'error', 'nonce', 'target', 'stageOwner', 'backupBoundary', 'payload']) await t.test(scenario, async t => {
    const { service, job } = await completedFixture(t);
    if (scenario === 'active') { const pending = JSON.parse(await fs.readFile(job.pendingFile)); pending.helperPid = process.pid; await core.atomicJSON(job.pendingFile, pending); }
    if (scenario === 'error') await core.atomicJSON(job.resultFile, { status: 'error', version: job.version });
    if (scenario === 'nonce') await core.atomicJSON(job.launchMarker, { token: 'b'.repeat(48), version: job.version, target: job.target });
    if (scenario === 'target') await core.atomicJSON(job.launchMarker, { token: job.token, version: job.version, target: '/foreign/AppImage' });
    if (scenario === 'stageOwner') await core.atomicJSON(path.join(job.stagingRoot, '.owner.json'), { userData: '/foreign', workRoot: job.workRoot, target: job.target });
    if (scenario === 'backupBoundary') await core.atomicJSON(path.join(job.workRoot, '.job.json'), { ...job, backupRoot: path.join(path.dirname(job.backupRoot), `.shiguang-backup-${'b'.repeat(24)}.noindex`) });
    if (scenario === 'payload') await fs.writeFile(job.target, appImageBytes());
    assert.equal((await service.reconcileCompletedUpdate({ timeoutMs: 15, intervalMs: 5 })).recovered, false);
    for (const directory of [job.backupRoot, job.stagingRoot, job.workRoot]) assert.ok((await fs.stat(directory)).isDirectory());
    assert.ok((await fs.stat(job.pendingFile)).isFile());
  });
});
