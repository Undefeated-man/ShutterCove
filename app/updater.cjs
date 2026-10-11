'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const core = require('./updater-core.cjs');
const run = promisify(execFile);
const DAY = 24 * 60 * 60 * 1000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForBootReady(readReady, { timeoutMs = 40_000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    try { if (await readReady() === true) return true; } catch {}
    if (Date.now() >= deadline) return false;
    await pause(Math.min(intervalMs, Math.max(1, deadline - Date.now())));
  } while (true);
}

class UpdateService {
  constructor({ app, emit = () => {}, automatic = () => true, disabled = false, beforeInstall, installFailed = () => {}, quit, openInstaller, platform = process.platform, arch = process.arch, execPath = process.execPath, appImage = process.env.APPIMAGE, transport = core.transfer }) {
    this.app = app; this.emit = emit; this.automatic = automatic; this.disabled = disabled;
    this.beforeInstall = beforeInstall; this.installFailed = installFailed; this.quit = quit; this.openInstaller = openInstaller;
    this.platform = platform; this.arch = arch; this.execPath = execPath; this.appImage = appImage; this.transport = transport;
    this.userData = app.getPath('userData'); this.currentVersion = app.getVersion();
    this.readyFile = path.join(this.userData, '.update-ready.json');
    this.updateBase = path.join(this.userData, '.updates.noindex');
    this.state = { status: 'idle', currentVersion: this.currentVersion, latestVersion: null, support: 'manual', installSupported: false, progress: null, message: '可检查正式发布版本', releaseURL: core.RELEASES_URL };
    this.busy = null; this.ready = null; this.release = null; this.record = {}; this.stopped = false;
  }
  snapshot() { return JSON.parse(JSON.stringify(this.state)); }
  set(patch) { this.state = { ...this.state, notify: false, ...patch }; this.emit(this.snapshot()); return this.snapshot(); }
  async init() {
    this.installation = await core.detectInstallation({ platform: this.platform, packaged: this.app.isPackaged, execPath: this.execPath, appImage: this.appImage, home: this.app.getPath('home') });
    this.stageParents = new Set([this.installation.parent].filter(Boolean));
    if (this.platform === 'darwin') for (const directory of ['/Applications', path.join(this.app.getPath('home'), 'Applications')]) { const real = await fs.realpath(directory).catch(() => null); if (real) this.stageParents.add(real); }
    this.state = { ...this.state, support: this.installation.support, installSupported: this.installation.installSupported, message: this.disabled ? '演示与测试模式不连接更新服务器' : this.installation.message };
    this.recordFile = path.join(this.userData, '.update-check-state.json');
    try { const saved = JSON.parse(await fs.readFile(this.recordFile, 'utf8')); if (saved && typeof saved === 'object' && !Array.isArray(saved)) this.record = { lastChecked: saved.lastChecked, notifiedVersion: saved.notifiedVersion }; } catch {}
    try {
      const result = JSON.parse(await fs.readFile(path.join(this.userData, '.update-result.json'), 'utf8'));
      if (result.status === 'error') this.state = { ...this.state, status: 'error', message: result.message };
      else if (result.status === 'completed' && result.version === this.currentVersion) this.state.message = result.message || `已更新至 ${this.currentVersion}`;
      await fs.rm(path.join(this.userData, '.update-result.json'), { force: true });
    } catch {}
    if (!this.disabled && this.app.isPackaged && this.installation.installSupported) await this.restoreReadyAndClean();
    if (!this.disabled) {
      this.startTimer = setTimeout(() => this.automaticCheck(), 10_000); this.startTimer.unref();
      this.interval = setInterval(() => this.automaticCheck(), 60 * 60 * 1000); this.interval.unref();
    }
    return this.snapshot();
  }
  stop() { this.stopped = true; clearTimeout(this.startTimer); clearInterval(this.interval); }
  automaticCheck() {
    if (!this.stopped && this.automatic() && !this.busy && !this.ready && Date.now() - (Number(this.record.lastChecked) || 0) >= DAY) return this.checkForUpdates({ automatic: true });
  }
  async checkForUpdates({ automatic = false } = {}) {
    if (this.disabled) return this.set({ status: 'error', message: '演示与测试模式不连接更新服务器' });
    if (this.busy) return this.snapshot();
    if (this.ready) return this.set({ status: 'ready', message: this.ready.format === 'deb' ? '下载已校验，可打开系统安装器' : '下载已校验，点击后会退出并在原位置重启' });
    this.busy = 'check'; this.set({ status: 'checking', progress: null, message: '正在检查 GitHub 正式发布版本…' });
    try {
      const fetched = await this.transport(core.RELEASE_API, { kind: 'api', maxBytes: 1024 * 1024, timeoutMs: 20_000 });
      const release = core.selectRelease(JSON.parse(fetched.data.toString('utf8')), this.currentVersion, this.platform, this.arch, this.installation.support === 'deb' ? 'deb' : 'AppImage');
      this.record.lastChecked = Date.now();
      await core.atomicJSON(this.recordFile, this.record);
      this.release = release;
      if (!release.newer) return this.set({ status: 'upToDate', latestVersion: release.version, message: '当前已是最新正式版本', releaseURL: release.releaseURL });
      const firstNotice = this.record.notifiedVersion !== release.version;
      if (firstNotice) { this.record.notifiedVersion = release.version; await core.atomicJSON(this.recordFile, this.record); }
      return this.set({ status: 'available', latestVersion: release.version, message: `发现新版本 ${release.version}。${this.installation.message}`, releaseURL: release.releaseURL, ...(automatic ? { notify: firstNotice } : { notify: false }) });
    } catch (error) {
      // Persist failed automatic checks too, so offline starts do not hammer GitHub.
      if (automatic) { this.record.lastChecked = Date.now(); await core.atomicJSON(this.recordFile, this.record).catch(() => {}); }
      return this.set({ status: 'error', message: this.safeError(error, '检查更新失败，请稍后重试') });
    } finally { this.busy = null; }
  }
  safeError(error, fallback) { return /^[\u4e00-\u9fff]/.test(error?.message || '') && !/[\/\\]/.test(error.message) ? error.message : fallback; }
  async privateJSON(file) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024 || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid())) throw new Error('更新记录权限无效');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }
  async ownedDirectory(file) {
    const stat = await fs.lstat(file);
    return stat.isDirectory() && !stat.isSymbolicLink() && (!process.getuid || stat.uid === process.getuid()) && await fs.realpath(file) === file;
  }
  validWorkRoot(workRoot) {
    return typeof workRoot === 'string' && path.dirname(workRoot) === this.updateBase && /^\.\d+\.\d+\.\d+-[A-Za-z\d]+$/.test(path.basename(workRoot));
  }
  readyBoundaries(saved) {
    if (!saved || saved.schema !== 1 || !['ready', 'downloading'].includes(saved.phase) || !core.versionParts(saved.version) || saved.platform !== this.platform || saved.arch !== this.arch || !/^[a-f\d]{24}$/.test(saved.suffix || '') || !/^[a-f\d]{64}$/.test(saved.sha256 || '') || !this.validWorkRoot(saved.workRoot)) return false;
    const format = this.platform === 'darwin' ? 'mac' : this.installation.support === 'deb' ? 'deb' : 'appimage';
    const assetArch = this.platform === 'linux' && this.arch === 'x64' ? (format === 'deb' ? 'amd64' : 'x86_64') : this.arch;
    const name = `Shiguang-Isle-${saved.version}-${this.platform === 'darwin' ? 'mac' : 'linux'}-${assetArch}.${format === 'mac' ? 'zip' : format === 'deb' ? 'deb' : 'AppImage'}`;
    if (saved.format !== format || saved.assetName !== name || saved.downloaded !== path.join(saved.workRoot, name) || !Number.isSafeInteger(saved.size) || saved.size < 1 || saved.size > core.MAX_ASSET || !/^v?\d+\.\d+\.\d+$/.test(saved.tag || '') || saved.tag.replace(/^v/, '') !== saved.version) return false;
    if (format === 'deb') return saved.target === null && saved.stagingRoot === null && saved.staged === saved.downloaded;
    if (saved.target !== this.installation.target || !this.installation.parent || saved.stagingRoot !== path.join(this.installation.parent, `.shiguang-update-${saved.suffix}.noindex`)) return false;
    if (format === 'appimage') return saved.staged === path.join(saved.stagingRoot, path.basename(saved.target));
    return typeof saved.bundleName === 'string' && saved.bundleName.endsWith('.app') && !/[\/\\\x00-\x1f]/.test(saved.bundleName) && saved.staged === path.join(saved.stagingRoot, saved.bundleName);
  }
  async validatePrepared(saved) {
    if (!this.readyBoundaries(saved) || saved.phase !== 'ready' || !core.newerVersion(saved.version, this.currentVersion) || !this.installation.installSupported || !await this.ownedDirectory(saved.workRoot)) throw new Error('已下载更新不适用于当前安装位置');
    const stat = await fs.lstat(saved.downloaded);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== saved.size || await core.hashFile(saved.downloaded) !== saved.sha256) throw new Error('已下载更新完整性校验失败');
    let helperExecutable = this.execPath;
    if (saved.format !== 'deb') {
      if (!await this.ownedDirectory(saved.stagingRoot)) throw new Error('更新准备目录无效');
      const owner = await this.privateJSON(path.join(saved.stagingRoot, '.owner.json'));
      if (owner.userData !== this.userData || owner.workRoot !== saved.workRoot || owner.target !== saved.target) throw new Error('更新准备目录不属于当前应用');
      if (saved.format === 'mac') helperExecutable = await core.validateMacBundle(saved.staged, saved.version, this.arch);
      else { await core.validateAppImage(saved.staged, this.arch); if (await core.hashFile(saved.staged) !== saved.sha256) throw new Error('已准备 AppImage 校验失败'); helperExecutable = saved.staged; }
    } else await this.validateDeb(saved.downloaded, saved.version);
    return { ...saved, helperExecutable };
  }
  async validateDeb(file, version) {
    const field = async name => (await run('/usr/bin/dpkg-deb', ['--field', file, name], { timeout: 30_000 })).stdout.trim();
    if (await field('Package') !== 'shiguang-isle' || await field('Version') !== version || await field('Architecture') !== (this.arch === 'x64' ? 'amd64' : 'arm64')) throw new Error('deb 更新包标识、版本或处理器架构不匹配');
  }
  async protectedPending() {
    try {
      const pending = await this.privateJSON(path.join(this.userData, '.update-pending.json'));
      if (!/^[a-f\d]{48}$/.test(pending.token || '') || !this.validWorkRoot(pending.workRoot)) return null;
      const job = await this.privateJSON(path.join(pending.workRoot, '.job.json'));
      require('./updater-helper.cjs').validateJob(job);
      if (job.token !== pending.token || job.workRoot !== pending.workRoot || job.userData !== this.userData) return null;
      let active = false;
      if (Number.isSafeInteger(pending.helperPid) && pending.helperPid > 0) { try { process.kill(pending.helperPid, 0); active = true; } catch (error) { active = error.code === 'EPERM'; } }
      const rollbackBackup = await fs.lstat(job.backupRoot).catch(() => null);
      if (active || rollbackBackup) return job;
      await fs.rm(path.join(this.userData, '.update-pending.json'), { force: true });
    } catch {}
    return null;
  }
  async removeOwnedStage(stagingRoot, workRoot) {
    if (!this.stageParents?.has(path.dirname(stagingRoot || '')) || !/^\.shiguang-update-[a-f\d]{24}\.noindex$/.test(path.basename(stagingRoot || ''))) return;
    try {
      if (!await this.ownedDirectory(stagingRoot)) return;
      const owner = await this.privateJSON(path.join(stagingRoot, '.owner.json'));
      if (owner.userData === this.userData && (!workRoot || owner.workRoot === workRoot) && this.validWorkRoot(owner.workRoot)) await fs.rm(stagingRoot, { recursive: true, force: true });
    } catch {}
  }
  async cleanOrphans(protectedJob) {
    const keptWork = new Set([this.ready?.workRoot, protectedJob?.workRoot].filter(Boolean));
    for (const name of await fs.readdir(this.updateBase).catch(() => [])) {
      const directory = path.join(this.updateBase, name);
      if (!this.validWorkRoot(directory) || keptWork.has(directory)) continue;
      try { if (await this.ownedDirectory(directory)) await fs.rm(directory, { recursive: true, force: true }); } catch {}
    }
    for (const parent of this.stageParents || []) {
      for (const name of await fs.readdir(parent).catch(() => [])) {
        const directory = path.join(parent, name);
        if (directory !== this.ready?.stagingRoot && directory !== protectedJob?.stagingRoot) await this.removeOwnedStage(directory);
      }
    }
  }
  async restoreReadyAndClean() {
    const protectedJob = await this.protectedPending();
    if (protectedJob) return; // A live helper or retained rollback backup owns these paths.
    let saved;
    try { saved = await this.privateJSON(this.readyFile); this.ready = await this.validatePrepared(saved); }
    catch {
      if (saved && this.readyBoundaries(saved)) await this.removeOwnedStage(saved.stagingRoot, saved.workRoot);
      await fs.rm(this.readyFile, { force: true }).catch(() => {});
    }
    if (this.ready) this.state = { ...this.state, status: 'ready', latestVersion: this.ready.version, releaseURL: `${core.RELEASES_URL}/tag/${encodeURIComponent(this.ready.tag)}`, progress: { receivedBytes: this.ready.size, totalBytes: this.ready.size, percent: 100 }, message: this.ready.format === 'deb' ? '已恢复校验过的下载，可打开系统安装器' : '已恢复校验过的下载，点击后会退出并在原位置重启' };
    await this.cleanOrphans();
  }
  async discardReady() {
    if (this.ready) {
      await this.removeOwnedStage(this.ready.stagingRoot, this.ready.workRoot);
      await fs.rm(this.ready.workRoot, { recursive: true, force: true });
    }
    this.ready = null;
    await fs.rm(this.readyFile, { force: true });
  }
  async downloadUpdate() {
    if (this.disabled) return this.set({ status: 'error', message: '演示与测试模式不连接更新服务器' });
    if (this.busy) return this.snapshot();
    if (await this.protectedPending()) return this.set({ status: 'error', message: '上次更新仍在完成或原应用备份仍需保留，请稍后重试或重新安装正式版本' });
    if (this.ready) return this.set({ status: 'ready', message: this.ready.format === 'deb' ? '下载已校验，可打开系统安装器' : '下载已校验，点击后会退出并在原位置重启' });
    if (!this.release?.newer) return this.set({ status: 'error', message: '请先检查是否有新版本' });
    if (!this.installation.installSupported && this.installation.support !== 'deb') return this.set({ status: 'error', message: this.installation.message });
    this.busy = 'download'; let workRoot, stagingRoot;
    this.set({ status: 'downloading', progress: { receivedBytes: 0, totalBytes: this.release.asset.size, percent: 0 }, message: '正在下载并校验更新…' });
    try {
      const base = this.updateBase; await fs.mkdir(base, { recursive: true, mode: 0o700 });
      if (!await this.ownedDirectory(base)) throw new Error('更新缓存目录不是安全的真实目录');
      workRoot = await fs.mkdtemp(path.join(base, `.${this.release.version}-`));
      const checksum = this.release.checksum, manifest = await this.transport(core.assetURL(checksum, this.release.tag), { maxBytes: 256 * 1024, expectedSize: checksum.size, timeoutMs: 30_000 });
      if (`sha256:${manifest.sha256}` !== checksum.digest.toLowerCase()) throw new Error('发布校验表下载校验失败');
      const expected = core.checksumFor(manifest.data.toString('utf8'), this.release.asset.name, this.release.asset.digest);
      const suffix = crypto.randomBytes(12).toString('hex'), format = this.platform === 'darwin' ? 'mac' : this.installation.support === 'deb' ? 'deb' : 'appimage';
      const downloaded = path.join(workRoot, this.release.asset.name), partial = `${downloaded}.part`;
      const prepared = { schema: 1, phase: 'downloading', workRoot, stagingRoot: format === 'deb' ? null : path.join(this.installation.parent, `.shiguang-update-${suffix}.noindex`), target: format === 'deb' ? null : this.installation.target, platform: this.platform, arch: this.arch, assetName: this.release.asset.name, downloaded, staged: format === 'deb' ? downloaded : null, bundleName: null, format, sha256: expected, size: this.release.asset.size, version: this.release.version, suffix, tag: this.release.tag };
      await core.atomicJSON(this.readyFile, prepared);
      let lastProgress = 0;
      const result = await this.transport(core.assetURL(this.release.asset, this.release.tag), { file: partial, maxBytes: core.MAX_ASSET, expectedSize: this.release.asset.size, timeoutMs: 15 * 60_000, progress: (receivedBytes, totalBytes) => { if (Date.now() - lastProgress >= 200 || receivedBytes === totalBytes) { lastProgress = Date.now(); this.set({ progress: { receivedBytes, totalBytes, percent: totalBytes ? Math.min(100, Math.floor(receivedBytes / totalBytes * 100)) : null } }); } } });
      if (result.sha256 !== expected) throw new Error('更新文件 SHA-256 校验失败，下载已丢弃');
      await fs.rename(partial, downloaded);
      let staged = downloaded, helperExecutable = this.execPath;
      if (format !== 'deb') {
        stagingRoot = prepared.stagingRoot; await fs.mkdir(stagingRoot, { mode: 0o700 });
        await core.atomicJSON(path.join(stagingRoot, '.owner.json'), { userData: this.userData, workRoot, target: this.installation.target });
        if (format === 'mac') {
          const bundleName = await core.inspectZip(downloaded);
          await run('/usr/bin/ditto', ['-x', '-k', downloaded, stagingRoot], { timeout: 120_000, maxBuffer: 1024 * 1024 });
          const extracted = await fs.readdir(stagingRoot);
          if (extracted.length !== 2 || !extracted.includes(bundleName) || !extracted.includes('.owner.json')) throw new Error('更新 ZIP 解压内容与记录不一致');
          prepared.bundleName = bundleName;
          staged = path.join(stagingRoot, bundleName); helperExecutable = await core.validateMacBundle(staged, this.release.version, this.arch);
        } else {
          staged = path.join(stagingRoot, path.basename(this.installation.target));
          await fs.copyFile(downloaded, staged); await fs.chmod(staged, this.installation.mode || 0o755);
          await core.validateAppImage(staged, this.arch); helperExecutable = staged;
        }
      } else {
        await this.validateDeb(downloaded, this.release.version);
      }
      prepared.phase = 'ready'; prepared.staged = staged;
      await core.atomicJSON(this.readyFile, prepared);
      this.ready = { ...prepared, helperExecutable };
      return this.set({ status: 'ready', progress: { receivedBytes: result.size, totalBytes: result.size, percent: 100 }, message: format === 'deb' ? '下载已校验，可打开系统安装器；安装完成后手动重新打开应用' : '下载与应用校验通过，点击后会退出并在原位置重启' });
    } catch (error) {
      if (stagingRoot) await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
      if (workRoot) await fs.rm(workRoot, { recursive: true, force: true }).catch(() => {});
      await fs.rm(this.readyFile, { force: true }).catch(() => {});
      return this.set({ status: 'error', progress: null, message: this.safeError(error, '下载或应用校验失败，原应用未改变，请重试') });
    } finally { this.busy = null; }
  }
  async installUpdate() {
    if (this.disabled) return this.set({ status: 'error', message: '演示与测试模式不安装更新' });
    if (this.busy) return this.snapshot();
    if (await this.protectedPending()) return this.set({ status: 'error', message: '上次更新仍在完成或原应用备份仍需保留，请稍后重试或重新安装正式版本' });
    if (!this.ready) return this.set({ status: 'error', message: '请先下载并校验更新' });
    if (this.ready.format === 'deb') {
      const error = await this.openInstaller(this.ready.staged);
      return this.set({ status: error ? 'error' : 'ready', message: error ? '无法打开系统安装器，请从正式发布页下载 deb 并使用系统包管理器安装' : '已打开系统安装器；请完成安装后手动重新打开拾光屿' });
    }
    this.busy = 'install'; this.set({ status: 'installing', message: '正在保存相册记录，即将退出并更新…' });
    let helper;
    try {
      const ready = this.ready;
      // Revalidate before closing; ready paths are private main-process state.
      if (ready.format === 'mac') await core.validateMacBundle(ready.staged, ready.version, this.arch);
      else if (await core.hashFile(ready.staged) !== ready.sha256) throw new Error('安装前更新校验失败，请重新下载');
      await this.beforeInstall();
      const metadataBackup = await core.backupMetadata(this.userData, this.currentVersion);
      const token = crypto.randomBytes(24).toString('hex'), target = this.installation.target, stat = await fs.lstat(target);
      const job = { platform: this.platform, arch: this.arch, target, staged: ready.staged, executableRelative: ready.format === 'mac' ? path.relative(ready.staged, ready.helperExecutable) : null, stagingRoot: ready.stagingRoot, backupRoot: path.join(this.installation.parent, `.shiguang-backup-${ready.suffix}.noindex`), workRoot: ready.workRoot, userData: this.userData, metadataBackup, readyFile: this.readyFile, resultFile: path.join(this.userData, '.update-result.json'), pendingFile: path.join(this.userData, '.update-pending.json'), launchMarker: path.join(ready.workRoot, '.launched.json'), token, version: ready.version, sha256: ready.sha256, parentPid: process.pid, targetIdentity: { dev: stat.dev, ino: stat.ino } };
      await fs.copyFile(path.join(__dirname, 'updater-helper.cjs'), path.join(ready.workRoot, 'updater-helper.cjs'));
      await fs.copyFile(path.join(__dirname, 'updater-core.cjs'), path.join(ready.workRoot, 'updater-core.cjs'));
      const jobFile = path.join(ready.workRoot, '.job.json'); await core.atomicJSON(jobFile, job);
      await core.atomicJSON(job.pendingFile, { token, version: ready.version, target, launchMarker: job.launchMarker, workRoot: ready.workRoot });
      helper = spawn(ready.helperExecutable, [path.join(ready.workRoot, 'updater-helper.cjs'), jobFile], { detached: true, stdio: 'ignore', cwd: ready.workRoot, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      await new Promise((resolve, reject) => { helper.once('spawn', resolve); helper.once('error', reject); });
      await core.atomicJSON(job.pendingFile, { token, version: ready.version, target, launchMarker: job.launchMarker, workRoot: ready.workRoot, helperPid: helper.pid });
      const deadline = Date.now() + 12_000;
      while (true) {
        const value = await fs.readFile(path.join(ready.workRoot, '.helper-ready'), 'utf8').catch(() => '');
        if (value === token) break;
        if (Date.now() > deadline || helper.exitCode !== null) throw new Error('更新助手未能启动，原应用未改变');
        await pause(100);
      }
      helper.unref(); this.stop(); this.quit();
      return this.snapshot();
    } catch (error) {
      if (helper) helper.kill();
      await fs.rm(path.join(this.userData, '.update-pending.json'), { force: true }).catch(() => {});
      await this.installFailed();
      return this.set({ status: 'error', message: this.safeError(error, '更新助手启动失败，原应用未改变，请重试') });
    } finally { this.busy = null; }
  }
  async acknowledgeRelaunch(token) {
    if (!/^[a-f\d]{48}$/.test(token || '')) return;
    try {
      const pending = JSON.parse(await fs.readFile(path.join(this.userData, '.update-pending.json'), 'utf8'));
      if (pending.token !== token || pending.version !== this.currentVersion || pending.target !== this.installation.target || !core.inside(path.join(this.userData, '.updates.noindex'), pending.workRoot) || !core.inside(pending.workRoot, pending.launchMarker) || pending.launchMarker !== path.join(pending.workRoot, '.launched.json')) return;
      await core.atomicJSON(pending.launchMarker, { token, version: this.currentVersion, target: this.installation.target });
    } catch {}
  }
}
module.exports = { UpdateService, waitForBootReady };
