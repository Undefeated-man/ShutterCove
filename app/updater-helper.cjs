'use strict';

// Runs independently from a verified new Electron/AppImage runtime. Never uses
// a shell command string or copies the photo library / preview cache.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { inside, atomicJSON, validateMacBundle, validateAppImage, hashFile, removePhysical } = require('./updater-core.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForParent(pid, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return; throw error; }
    if (Date.now() > deadline) throw new Error('应用没有及时退出，更新已取消');
    await pause(200);
  }
}
async function waitForLaunch(job, timeoutMs = 45_000, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error('新版本启动后提前退出，已尝试恢复原版本');
    try {
      const receipt = JSON.parse(await fs.readFile(job.launchMarker, 'utf8'));
      if (receipt.token === job.token && receipt.version === job.version && receipt.target === job.target) return;
    } catch {}
    await pause(200);
  }
  throw new Error('新版本未能完成启动，已尝试恢复原版本');
}
async function stopLaunchedChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const deadline = Date.now() + 5000;
  while (child.exitCode === null && child.signalCode === null && Date.now() <= deadline) await pause(100);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    const forcedDeadline = Date.now() + 5000;
    while (child.exitCode === null && child.signalCode === null && Date.now() <= forcedDeadline) await pause(100);
    if (child.exitCode === null && child.signalCode === null) throw new Error('新版本仍在运行，保留原应用备份等待恢复');
  }
}
async function launch(job, updated = true) {
  const args = updated ? ['--update-relaunch', job.token] : [];
  const executable = job.platform === 'darwin' ? path.join(job.target, job.executableRelative) : job.target;
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.APPIMAGE; delete env.APPDIR;
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', cwd: path.dirname(job.target), env });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  if (updated) {
    try { await waitForLaunch(job, 45_000, child); }
    catch (error) {
      try { await stopLaunchedChild(child); } catch (stopError) { stopError.unsafeRollback = true; throw stopError; }
      throw error;
    }
  }
  child.unref();
}
async function restoreMetadata(job) {
  if (!job.metadataBackup) return;
  for (const name of ['settings.json', 'library.json']) {
    const source = path.join(job.metadataBackup, name), target = path.join(job.userData, name);
    try {
      const stat = await fs.lstat(source); if (!stat.isFile() || stat.isSymbolicLink()) continue;
      const temp = `${target}.${crypto.randomBytes(8).toString('hex')}.tmp`;
      try { await fs.copyFile(source, temp); await fs.chmod(temp, 0o600); await fs.rename(temp, target); }
      finally { await fs.rm(temp, { force: true }); }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
async function transactionalReplace(job, { launchNew = () => launch(job), launchOld = () => launch(job, false), verify = async () => {}, rename = fs.rename } = {}) {
  const backup = path.join(job.backupRoot, path.basename(job.target));
  let movedOld = false, installed = false, restored = false, committed = false;
  await fs.mkdir(job.backupRoot, { mode: 0o700 });
  try {
    await verify();
    const stat = await fs.lstat(job.target);
    if (stat.isSymbolicLink() || (job.targetIdentity && (stat.dev !== job.targetIdentity.dev || stat.ino !== job.targetIdentity.ino))) throw new Error('当前应用位置发生变化，更新已取消');
    await rename(job.target, backup); movedOld = true;
    await rename(job.staged, job.target); installed = true;
    await launchNew();
    committed = true;
    await atomicJSON(job.resultFile, { status: 'completed', version: job.version, token: job.token, target: job.target, message: `已更新至 ${job.version}` });
    await removePhysical(job.backupRoot, { recursive: true, force: true });
    await removePhysical(job.stagingRoot, { recursive: true, force: true });
    await removePhysical(job.workRoot, { recursive: true, force: true });
    if (job.readyFile) await fs.rm(job.readyFile, { force: true });
    await fs.rm(job.pendingFile, { force: true });
    return { updated: true };
  } catch (error) {
    if (committed) {
      // A cleanup error must never roll back a healthy, running new version.
      await atomicJSON(job.resultFile, { status: 'completed', version: job.version, token: job.token, target: job.target, message: `已更新至 ${job.version}；旧应用备份或临时文件仍保留`, cleanupErrorCode: error.code || 'UNKNOWN' }).catch(() => {});
      return { updated: true, cleanupPending: true };
    }
    if (error.unsafeRollback) {
      await atomicJSON(job.resultFile, { status: 'error', version: job.version, message: '新版本仍在运行，原应用备份已保留；请退出应用后重新安装正式版本' }).catch(() => {});
      return { updated: false, restored: false };
    }
    try {
      if (installed) {
        // Keep the failed payload hidden while restoring the original name.
        await rename(job.target, path.join(job.stagingRoot, '.failed-payload'));
      }
      if (movedOld) { await rename(backup, job.target); restored = true; }
      await restoreMetadata(job);
      await atomicJSON(job.resultFile, { status: 'error', version: job.version, message: restored || !movedOld ? '更新未完成，原版本已保留；请重试或从正式发布页下载安装' : '更新未完成，请从正式发布页重新安装；相册记录备份已保留' });
      await fs.rm(job.pendingFile, { force: true });
      if (restored || !movedOld) {
        await removePhysical(job.backupRoot, { recursive: true, force: true });
        await removePhysical(job.stagingRoot, { recursive: true, force: true });
        await removePhysical(job.workRoot, { recursive: true, force: true });
        if (job.readyFile) await fs.rm(job.readyFile, { force: true });
        await launchOld();
      }
    } catch {
      // If rollback itself fails, retain the hidden backup for recovery.
      await atomicJSON(job.resultFile, { status: 'error', version: job.version, message: '更新和恢复未完成，原应用备份及相册记录已保留；请重新安装正式版本' }).catch(() => {});
    }
    return { updated: false, restored, message: error.message };
  }
}
function validateJob(job) {
  if (!job || !['darwin', 'linux'].includes(job.platform) || !Number.isSafeInteger(job.parentPid) || job.parentPid <= 0 || !/^[a-f\d]{48}$/.test(job.token || '') || !/^\d+\.\d+\.\d+$/.test(job.version || '')) throw new Error('更新任务无效');
  for (const field of ['target', 'staged', 'stagingRoot', 'backupRoot', 'workRoot', 'resultFile', 'pendingFile', 'launchMarker', 'userData', 'metadataBackup']) if (typeof job[field] !== 'string' || !path.isAbsolute(job[field])) throw new Error('更新任务路径无效');
  if (!path.basename(job.stagingRoot).startsWith('.shiguang-update-') || !job.stagingRoot.endsWith('.noindex') || !path.basename(job.backupRoot).startsWith('.shiguang-backup-') || !job.backupRoot.endsWith('.noindex') || path.dirname(job.stagingRoot) !== path.dirname(job.target) || path.dirname(job.backupRoot) !== path.dirname(job.target) || !inside(job.stagingRoot, job.staged) || !inside(job.workRoot, job.launchMarker) || !inside(path.join(job.userData, '.update-metadata-backups.noindex'), job.metadataBackup) || job.resultFile !== path.join(job.userData, '.update-result.json') || job.pendingFile !== path.join(job.userData, '.update-pending.json')) throw new Error('更新任务边界无效');
  if (job.platform === 'darwin' && (typeof job.executableRelative !== 'string' || !/^Contents\/MacOS\/[^/\\]+$/.test(job.executableRelative))) throw new Error('更新启动路径无效');
  if (job.readyFile && job.readyFile !== path.join(job.userData, '.update-ready.json')) throw new Error('更新准备记录路径无效');
}
async function main(jobFile) {
  const stat = await fs.lstat(jobFile);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid())) throw new Error('更新任务权限无效');
  const job = JSON.parse(await fs.readFile(jobFile, 'utf8')); validateJob(job);
  await fs.writeFile(path.join(job.workRoot, '.helper-ready'), job.token, { mode: 0o600 });
  try { await waitForParent(job.parentPid); }
  catch {
    await atomicJSON(job.resultFile, { status: 'error', version: job.version, message: '应用没有及时退出，更新已取消，原应用未改变' });
    await fs.rm(job.pendingFile, { force: true });
    return;
  }
  const verify = async () => {
    if (job.platform === 'darwin') await validateMacBundle(job.staged, job.version, job.arch);
    else {
      await validateAppImage(job.staged, job.arch);
      if (await hashFile(job.staged) !== job.sha256) throw new Error('安装前 AppImage 校验失败');
    }
  };
  await transactionalReplace(job, { verify });
}
if (require.main === module) main(process.argv[2]).catch(() => { process.exitCode = 1; });
module.exports = { waitForParent, waitForLaunch, stopLaunchedChild, launch, transactionalReplace, validateJob, restoreMetadata };
