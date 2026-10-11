'use strict';

// The renderer never supplies a URL, destination, version or installer argument.
const fs = require('node:fs/promises');
// Electron's regular fs sees app.asar as a virtual directory. Recursive rm can
// therefore leave the physical archive behind and fail with ENOTEMPTY. Only
// physical cleanup uses original-fs; normal reads must keep ASAR support.
const physicalFS = (() => {
  try { return require('original-fs').promises; }
  catch { return fs; } // Plain Node (tests and the private acceptance driver).
})();
const removePhysical = (file, options) => physicalFS.rm(file, options);
const { createReadStream, constants } = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const REPOSITORY = 'Undefeated-man/shiguang-isle';
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;
const MAX_ASSET = 1024 * 1024 * 1024;
const DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

function versionParts(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function newerVersion(candidate, current) {
  const a = versionParts(candidate), b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function trustedURL(value, kind = 'download') {
  let url;
  try { url = new URL(value); } catch { throw new Error('更新链接无效'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash) throw new Error('更新链接不是可信 HTTPS 地址');
  if (kind === 'api' ? url.href !== RELEASE_API : !DOWNLOAD_HOSTS.has(url.hostname)) throw new Error('更新链接来自未授权的服务器');
  return url;
}
function assetURL(asset, tag) {
  if (!asset || typeof asset.name !== 'string' || asset.name.includes('/') || asset.name.includes('\\')) throw new Error('发布文件名称无效');
  const url = trustedURL(asset.browser_download_url);
  const expected = `/${REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
  if (url.hostname !== 'github.com' || url.pathname !== expected || url.search) throw new Error('发布文件不属于此版本的官方仓库');
  if (asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_ASSET) throw new Error('发布文件大小或状态无效');
  if (!/^sha256:[a-f\d]{64}$/i.test(asset.digest || '')) throw new Error('发布文件缺少 GitHub SHA-256 校验，暂不能更新');
  return url.href;
}
function selectRelease(release, currentVersion, platform, arch, format) {
  if (!release || release.draft !== false || release.prerelease !== false || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name || '')) throw new Error('发布版本不是正式稳定版本');
  const version = release.tag_name.replace(/^v/, '');
  if (!versionParts(version)) throw new Error('发布版本号无效');
  if (!newerVersion(version, currentVersion)) return { version, newer: false, releaseURL: `${RELEASES_URL}/tag/${encodeURIComponent(release.tag_name)}` };
  if (!['arm64', 'x64'].includes(arch)) throw new Error('当前处理器架构暂不支持应用内更新');
  const ext = platform === 'darwin' ? 'zip' : platform === 'linux' ? (format === 'deb' ? 'deb' : 'AppImage') : null;
  if (!ext) throw new Error('当前系统暂不支持应用内更新');
  const assetArch = platform === 'linux' && arch === 'x64' ? (ext === 'deb' ? 'amd64' : 'x86_64') : arch;
  const name = `Shiguang-Isle-${version}-${platform === 'darwin' ? 'mac' : 'linux'}-${assetArch}.${ext}`;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const matches = assets.filter(a => a.name === name), sums = assets.filter(a => a.name === 'SHA256SUMS.txt');
  if (matches.length !== 1 || sums.length !== 1) throw new Error('此版本尚未提供当前系统的完整更新文件');
  const asset = matches[0], checksum = sums[0];
  assetURL(asset, release.tag_name); assetURL(checksum, release.tag_name);
  if (checksum.size > 256 * 1024) throw new Error('发布校验表过大');
  return { version, newer: true, asset, checksum, tag: release.tag_name, releaseURL: `${RELEASES_URL}/tag/${encodeURIComponent(release.tag_name)}` };
}
function checksumFor(text, name, digest) {
  const matches = String(text).split(/\r?\n/).map(line => line.match(/^([a-f\d]{64})[ \t]+\*?(.+)$/i)).filter(match => match && match[2] === name);
  if (matches.length !== 1 || !/^sha256:[a-f\d]{64}$/i.test(digest || '') || matches[0][1].toLowerCase() !== digest.slice(7).toLowerCase()) throw new Error('发布校验表与 GitHub 文件摘要不一致');
  return matches[0][1].toLowerCase();
}
async function transfer(url, { kind = 'download', file, maxBytes = 1024 * 1024, expectedSize, timeoutMs = 25_000, idleTimeoutMs = 30_000, progress = () => {}, request = https.request } = {}) {
  const deadline = Date.now() + timeoutMs;
  async function open(value, redirects = 0) {
    const target = trustedURL(value, kind);
    if (redirects > 5) throw new Error('更新下载重定向过多');
    return new Promise((resolve, reject) => {
      let response;
      const req = request(target, { method: 'GET', headers: { 'User-Agent': 'Shiguang-Isle-Updater', Accept: kind === 'api' ? 'application/vnd.github+json' : 'application/octet-stream', 'Accept-Encoding': 'identity', ...(kind === 'api' ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}) } }, res => {
        response = res;
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume(); clearTimeout(timer);
          if (!res.headers.location || kind === 'api') { reject(new Error('更新服务器重定向无效')); return; }
          let next;
          try { next = trustedURL(new URL(res.headers.location, target).href, kind).href; } catch (error) { reject(error); return; }
          open(next, redirects + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume(); clearTimeout(timer);
          reject(new Error(res.statusCode === 403 || res.statusCode === 429 ? 'GitHub 检查次数受限，请稍后重试' : '更新服务器暂时不可用，请稍后重试')); return;
        }
        const length = Number(res.headers['content-length']);
        if (Number.isFinite(length) && (length > maxBytes || (expectedSize && length !== expectedSize))) {
          clearTimeout(timer); res.destroy(); reject(new Error('更新文件大小与发布记录不一致')); return;
        }
        resolve({ res, cleanup: () => clearTimeout(timer) });
      });
      const timer = setTimeout(() => { const error = new Error('更新请求超时，请检查网络后重试'); response?.destroy(error); req.destroy(error); reject(error); }, Math.max(1, deadline - Date.now()));
      req.setTimeout?.(idleTimeoutMs, () => { const error = new Error('更新下载超时，请检查网络后重试'); response?.destroy(error); req.destroy(error); });
      req.once('error', error => { clearTimeout(timer); reject(/^更新/.test(error.message) ? error : new Error('无法连接更新服务器，请检查网络后重试')); });
      req.end();
    });
  }
  let response, handle;
  try {
    response = await open(url);
    if (file) handle = await fs.open(file, 'wx', 0o600);
    const chunks = [], hash = crypto.createHash('sha256');
    let received = 0;
    for await (const chunk of response.res) {
      received += chunk.length;
      if (received > maxBytes || (expectedSize && received > expectedSize)) throw new Error('更新文件超出发布记录大小');
      hash.update(chunk);
      if (handle) await handle.writeFile(chunk); else chunks.push(chunk);
      progress(received, expectedSize || Number(response.res.headers['content-length']) || null);
    }
    if (expectedSize && received !== expectedSize) throw new Error('更新下载不完整，请重试');
    if (handle) await handle.sync();
    return { data: file ? null : Buffer.concat(chunks), sha256: hash.digest('hex'), size: received };
  } finally {
    response?.cleanup(); response?.res.destroy(); await handle?.close();
  }
}
async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function inside(base, value) {
  const relative = path.relative(base, value);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function inspectZip(file) {
  const input = await fs.open(file, 'r');
  try {
    const { size } = await input.stat(), tailSize = Math.min(size, 65557), tail = Buffer.alloc(tailSize);
    await input.read(tail, 0, tailSize, size - tailSize);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
    if (end < 0 || tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6)) throw new Error('更新 ZIP 格式无效');
    const count = tail.readUInt16LE(end + 10), centralSize = tail.readUInt32LE(end + 12), centralOffset = tail.readUInt32LE(end + 16);
    if (!count || count === 65535 || count !== tail.readUInt16LE(end + 8) || centralSize > 20 * 1024 * 1024 || centralOffset + centralSize > size - tailSize + end) throw new Error('更新 ZIP 目录无效');
    const central = Buffer.alloc(centralSize); await input.read(central, 0, centralSize, centralOffset);
    const entries = [], names = new Set(); let cursor = 0, expanded = 0, root;
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014b50) throw new Error('更新 ZIP 目录损坏');
      const flags = central.readUInt16LE(cursor + 8), method = central.readUInt16LE(cursor + 10), compressed = central.readUInt32LE(cursor + 20), unpacked = central.readUInt32LE(cursor + 24), nameLength = central.readUInt16LE(cursor + 28), extraLength = central.readUInt16LE(cursor + 30), commentLength = central.readUInt16LE(cursor + 32), mode = central.readUInt32LE(cursor + 38) >>> 16, offset = central.readUInt32LE(cursor + 42);
      if (cursor + 46 + nameLength + extraLength + commentLength > central.length || flags & 1 || ![0, 8].includes(method) || [compressed, unpacked, offset].includes(0xffffffff)) throw new Error('更新 ZIP 使用不支持的格式');
      const nameBytes = central.subarray(cursor + 46, cursor + 46 + nameLength), name = nameBytes.toString('utf8');
      if (!name || name.includes('\uFFFD') || /[\x00-\x1f\\]/.test(name) || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.') || /^[A-Za-z]:/.test(name)) throw new Error('更新 ZIP 包含不安全的路径');
      const normalized = name.replace(/\/$/, '');
      if (path.posix.normalize(normalized) !== normalized) throw new Error('更新 ZIP 包含非规范路径');
      if (names.has(normalized)) throw new Error('更新 ZIP 包含重复路径'); names.add(normalized);
      const top = normalized.split('/')[0];
      if (!top.endsWith('.app') || (root && root !== top)) throw new Error('更新 ZIP 必须只包含一个应用'); root = top;
      const type = mode & 0o170000;
      if (mode & 0o6000) throw new Error('更新 ZIP 包含特殊权限文件');
      if (type && ![0o100000, 0o040000, 0o120000].includes(type)) throw new Error('更新 ZIP 包含特殊文件');
      expanded += unpacked;
      if (expanded > 2 * MAX_ASSET || offset + 30 + compressed > centralOffset) throw new Error('更新 ZIP 解压大小无效');
      const header = Buffer.alloc(30); await input.read(header, 0, 30, offset);
      if (header.readUInt32LE(0) !== 0x04034b50 || header.readUInt16LE(8) !== method || header.readUInt16LE(6) !== flags || header.readUInt16LE(26) !== nameLength) throw new Error('更新 ZIP 文件头不一致');
      if (offset + 30 + nameLength + header.readUInt16LE(28) + compressed > centralOffset) throw new Error('更新 ZIP 文件越过安全边界');
      const localName = Buffer.alloc(nameLength); await input.read(localName, 0, nameLength, offset + 30);
      if (!localName.equals(nameBytes)) throw new Error('更新 ZIP 路径记录不一致');
      const entry = { name: normalized, type, target: null };
      if (type === 0o120000) {
        if (unpacked < 1 || unpacked > 4096 || compressed > 8192) throw new Error('更新 ZIP 链接无效');
        const data = Buffer.alloc(compressed); await input.read(data, 0, compressed, offset + 30 + nameLength + header.readUInt16LE(28));
        const target = (method === 0 ? data : zlib.inflateRawSync(data, { maxOutputLength: 4096 })).toString('utf8');
        if (target.includes('\uFFFD') || /[\x00-\x1f\\]/.test(target) || target.startsWith('/') || /^[A-Za-z]:/.test(target)) throw new Error('更新 ZIP 链接不安全');
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(normalized), target));
        if (resolved !== root && !resolved.startsWith(`${root}/`)) throw new Error('更新 ZIP 链接指向应用外');
        entry.target = resolved;
      }
      entries.push(entry); cursor += 46 + nameLength + extraLength + commentLength;
    }
    if (cursor !== central.length) throw new Error('更新 ZIP 目录不完整');
    const links = new Map(entries.filter(e => e.target).map(e => [e.name, e.target]));
    for (const entry of entries) {
      let value = entry.name;
      for (let hop = 0; ; hop++) {
        if (hop > 40) throw new Error('更新 ZIP 链接循环');
        const parts = value.split('/'); let replaced = false;
        for (let i = 1; i <= parts.length; i++) {
          const target = links.get(parts.slice(0, i).join('/'));
          if (target) { value = path.posix.normalize([target, ...parts.slice(i)].join('/')); replaced = true; break; }
        }
        if (value !== root && !value.startsWith(`${root}/`)) throw new Error('更新 ZIP 链接链指向应用外');
        if (!replaced) break;
      }
    }
    return root;
  } finally { await input.close(); }
}
async function validateTree(bundle) {
  const root = await fs.realpath(bundle); let count = 0;
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (++count > 50_000) throw new Error('解压后的更新文件过多');
      const file = path.join(directory, entry.name), stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) { if (!inside(root, await fs.realpath(file))) throw new Error('更新应用包含指向外部的链接'); }
      else if (stat.isDirectory()) await visit(file);
      else if (!stat.isFile() || stat.nlink > 1) throw new Error('更新应用包含特殊文件或硬链接');
    }
  }
  await visit(root);
}
async function validateMacBundle(bundle, version, arch, execute = run) {
  if ((await fs.lstat(bundle)).isSymbolicLink()) throw new Error('更新应用不能是符号链接');
  await validateTree(bundle);
  const plist = path.join(bundle, 'Contents', 'Info.plist');
  const field = async key => (await execute('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], { timeout: 30_000 })).stdout.trim();
  if (await field('CFBundleIdentifier') !== 'org.shiguang.isle' || await field('CFBundleShortVersionString') !== version || await field('CFBundleVersion') !== version) throw new Error('更新应用标识或版本不匹配');
  const name = await field('CFBundleExecutable');
  if (!name || /[\x00-\x1f/\\]/.test(name) || name === '.' || name === '..') throw new Error('更新应用可执行文件无效');
  const executable = path.join(bundle, 'Contents', 'MacOS', name), stat = await fs.lstat(executable);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('更新应用可执行文件无效');
  await fs.access(executable, constants.X_OK);
  const architectures = (await execute('/usr/bin/lipo', ['-archs', executable], { timeout: 30_000 })).stdout.trim().split(/\s+/);
  if (!architectures.includes(arch === 'x64' ? 'x86_64' : arch)) throw new Error('更新应用处理器架构不匹配');
  await execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { timeout: 120_000, maxBuffer: 1024 * 1024 });
  return executable;
}
async function validateAppImage(file, arch) {
  const input = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(64), { bytesRead } = await input.read(header, 0, 64, 0);
    if (bytesRead !== 64 || !header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || header[4] !== 2 || header[5] !== 1 || header[8] !== 0x41 || header[9] !== 0x49 || header[10] !== 2 || header.readUInt16LE(18) !== (arch === 'arm64' ? 183 : 62)) throw new Error('AppImage 格式或处理器架构不匹配');
  } finally { await input.close(); }
}
async function detectInstallation({ platform, packaged, execPath, appImage, home }) {
  if (!packaged) return { support: 'manual', installSupported: false, message: '开发版本请从正式发布页下载安装' };
  if (platform === 'darwin') {
    const bundle = path.dirname(path.dirname(path.dirname(execPath)));
    try {
      const stat = await fs.lstat(bundle), parent = await fs.realpath(path.dirname(bundle));
      const roots = await Promise.all(['/Applications', path.join(home, 'Applications')].map(p => fs.realpath(p).catch(() => null)));
      if (!stat.isDirectory() || stat.isSymbolicLink() || !bundle.endsWith('.app') || !roots.includes(parent) || await fs.realpath(bundle) !== bundle) throw new Error();
      await fs.access(parent, constants.W_OK | constants.X_OK);
      return { support: 'mac', installSupported: true, target: bundle, parent, message: '更新会替换当前应用并在原位置重新打开' };
    } catch { return { support: 'mac', installSupported: false, message: '请先将当前应用移入 /Applications 或 ~/Applications，并确认有写入权限，再更新' }; }
  }
  if (platform === 'linux' && appImage) {
    try {
      const target = path.resolve(appImage), stat = await fs.lstat(target), parent = await fs.realpath(path.dirname(target));
      if (!stat.isFile() || stat.isSymbolicLink() || await fs.realpath(target) !== target) throw new Error();
      await fs.access(target, constants.W_OK | constants.X_OK); await fs.access(parent, constants.W_OK | constants.X_OK);
      return { support: 'appimage', installSupported: true, target, parent, mode: stat.mode & 0o777, message: '更新会替换当前 AppImage，并在原位置重新打开' };
    } catch { return { support: 'appimage', installSupported: false, message: '当前 AppImage 不可写，请移至可写目录后重新打开再更新' }; }
  }
  if (platform === 'linux') {
    try {
      // electron-builder FpmTarget installs sanitizedProductName beneath /opt.
      // A packaged linux-unpacked binary is not an installed Debian package.
      const installedExecutable = '/opt/Shiguang Isle/shiguang-isle';
      if (await fs.realpath(execPath) !== installedExecutable || !(await fs.lstat(installedExecutable)).isFile()) throw new Error();
      const status = (await run('/usr/bin/dpkg-query', ['--show', '--showformat=${db:Status-Status}\t${Package}', 'shiguang-isle'], { timeout: 15_000 })).stdout.trim();
      if (status !== 'installed\tshiguang-isle') throw new Error();
      return { support: 'deb', installSupported: true, message: 'deb 更新会打开系统安装器，需按系统提示授权安装后手动重启；推荐 AppImage 使用一键更新' };
    } catch { return { support: 'manual', installSupported: false, message: '当前 Linux 应用来自未安装的目录，请安装正式 deb 或使用 AppImage 更新' }; }
  }
  return { support: 'manual', installSupported: false, message: '当前系统暂不支持一键更新' };
}
async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
async function backupMetadata(userData, version, { keep = 3, preserve = [] } = {}) {
  const base = path.join(userData, '.update-metadata-backups.noindex');
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(base)).isSymbolicLink() || await fs.realpath(base) !== base) throw new Error('相册记录备份目录不是安全的真实目录');
  const target = await fs.mkdtemp(path.join(base, `.${version}-`));
  for (const name of ['settings.json', 'library.json']) {
    const source = path.join(userData, name);
    let stat; try { stat = await fs.lstat(source); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) throw new Error('相册记录备份无法安全完成');
    await fs.copyFile(source, path.join(target, name), constants.COPYFILE_EXCL); await fs.chmod(path.join(target, name), 0o600);
  }
  const retained = [];
  for (const name of await fs.readdir(base)) {
    if (!/^\.\d+\.\d+\.\d+-[A-Za-z\d]+$/.test(name)) continue;
    const file = path.join(base, name), stat = await fs.lstat(file);
    if (stat.isDirectory() && !stat.isSymbolicLink() && !preserve.includes(file) && file !== target) retained.push({ file, modified: stat.mtimeMs });
  }
  retained.sort((a, b) => b.modified - a.modified);
  for (const old of retained.slice(Math.max(0, keep - 1))) await removePhysical(old.file, { recursive: true, force: true });
  return target;
}
module.exports = { REPOSITORY, RELEASE_API, RELEASES_URL, MAX_ASSET, versionParts, newerVersion, trustedURL, assetURL, selectRelease, checksumFor, transfer, hashFile, inside, inspectZip, validateTree, validateMacBundle, validateAppImage, detectInstallation, atomicJSON, backupMetadata, removePhysical };
