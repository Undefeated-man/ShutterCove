const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createReadStream } = require('node:fs');
const { Readable } = require('node:stream');
const { PhotoLibrary } = require('./library.cjs');
const { UpdateService, waitForBootReady } = require('./updater.cjs');
const run = promisify(execFile);
protocol.registerSchemesAsPrivileged([
  { scheme: 'memory-app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'memory-photo', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);
let win, library, settings, settingsPath, updater;
let settingsSaveChain = Promise.resolve(), installingUpdate = false;
const activeOperations = new Set();
let exitStatus = 0;
const approvedRoots = new Set();
const mediaTokens = new Map();
const syncPlans = new Map();
const syncBatches = new Set();
const copyDestinations = new Set();
const demo = process.argv.includes('--demo');
const screenshotIndex = process.argv.indexOf('--screenshot');
const smoke = process.argv.includes('--smoke');
const screenshotPath = screenshotIndex >= 0 ? process.argv[screenshotIndex + 1] : null;
const qaIndex = process.argv.indexOf('--qa-script');
const qaScript = qaIndex >= 0 ? process.argv[qaIndex + 1] : null;
const verifyIndex = process.argv.indexOf('--verify-root');
const verifyRoot = verifyIndex >= 0 ? process.argv[verifyIndex + 1] : null;
const outputIndex = process.argv.indexOf('--qa-output');
const qaOutput = smoke && outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const qaDataIndex = process.argv.indexOf('--qa-user-data');
const qaUserData = smoke && qaDataIndex >= 0 ? process.argv[qaDataIndex + 1] : null;
app.setName('Shiguang Isle');
app.setPath('userData', path.join(app.getPath('appData'), 'Shiguang Isle'));
if (smoke) app.setPath('userData', qaUserData ? path.resolve(qaUserData) : path.join(app.getPath('temp'), `shiguang-smoke-${process.pid}`));
const ownsInstance = !app.isPackaged || smoke || app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

async function atomicJSON(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}
async function detectEditor(editor) {
  if (process.platform !== 'darwin') return '';
  const matcher = editor === 'photoshop' ? /photoshop/i : /lightroom/i;
  for (const base of ['/Applications', path.join(app.getPath('home'), 'Applications')]) {
    const entries = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
    for (const e of entries.filter(e => matcher.test(e.name))) {
      if (e.name.endsWith('.app')) return path.join(base, e.name);
      if (e.isDirectory()) {
        const sub = await fs.readdir(path.join(base, e.name)).catch(() => []);
        const appName = sub.find(n => matcher.test(n) && n.endsWith('.app'));
        if (appName) return path.join(base, e.name, appName);
      }
    }
  }
  return '';
}
function publicSettings() { return { ...settings, currentVersion: app.getVersion() }; }
function saveSettings(patch = {}) {
  const operation = settingsSaveChain.catch(() => {}).then(() => persistSettings(patch));
  settingsSaveChain = operation;
  return operation;
}
async function persistSettings(patch = {}) {
  const next = { ...settings, editorPaths: { ...settings.editorPaths } };
  for (const key of ['libraryRoot', 'importDestination']) {
    if (typeof patch[key] === 'string' && patch[key] && patch[key] !== settings[key]) {
      const resolved = await fs.realpath(patch[key]);
      if (!(await fs.stat(resolved)).isDirectory()) throw new Error('请选择一个文件夹');
      if (!approvedRoots.has(resolved)) throw new Error('请通过“选择文件夹”设置目录');
      next[key] = resolved;
      approvedRoots.add(resolved);
    }
  }
  if (patch.editorPaths && typeof patch.editorPaths === 'object') {
    for (const editor of ['photoshop', 'lightroom']) {
      if (typeof patch.editorPaths[editor] === 'string') next.editorPaths[editor] = patch.editorPaths[editor];
    }
  }
  if (Object.hasOwn(patch, 'fontScale')) {
    if (typeof patch.fontScale !== 'number' || !Number.isFinite(patch.fontScale)) throw new Error('请选择有效的字体大小');
    next.fontScale = Math.min(1.5, Math.max(1, patch.fontScale));
  }
  if (Object.hasOwn(patch, 'onboardingCompleted')) {
    if (typeof patch.onboardingCompleted !== 'boolean') throw new Error('无效的使用引导状态');
    next.onboardingCompleted = patch.onboardingCompleted;
  }
  if (Object.hasOwn(patch, 'checkUpdatesAutomatically')) {
    if (typeof patch.checkUpdatesAutomatically !== 'boolean') throw new Error('无效的自动更新检查设置');
    next.checkUpdatesAutomatically = patch.checkUpdatesAutomatically;
  }
  await atomicJSON(settingsPath, next);
  settings = next;
  return publicSettings();
}
async function approvedFolder(folder) {
  if (!folder || typeof folder !== 'string') throw new Error('请先选择照片文件夹');
  const real = await fs.realpath(folder);
  if (!approvedRoots.has(real)) throw new Error('请通过“选择文件夹”授权访问该目录');
  return real;
}
function mediaURL(file) {
  const token = crypto.randomBytes(24).toString('hex');
  mediaTokens.set(token, file);
  if (mediaTokens.size > 2000) mediaTokens.delete(mediaTokens.keys().next().value);
  return `memory-photo://asset/${token}`;
}
async function diskResponse(file, media = false) {
  const stat = await fs.stat(file);
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file).toLowerCase()] || 'application/octet-stream';
  return new Response(Readable.toWeb(createReadStream(file)), { headers: { 'Content-Type': mime, 'Content-Length': String(stat.size), 'X-Content-Type-Options': 'nosniff', ...(media ? { 'Access-Control-Allow-Origin': 'memory-app://app', 'Cache-Control': 'private, max-age=3600' } : {}) } });
}
function handle(name, callback) {
  ipcMain.handle(`memory:${name}`, async (event, args) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.senderFrame.url.startsWith('memory-app://app/')) throw new Error('未经授权的请求');
    if (installingUpdate && !['getUpdateState', 'getSettings'].includes(name)) throw new Error('正在更新，请等待应用重新打开');
    const tracks = !['getUpdateState', 'checkForUpdates', 'downloadUpdate', 'installUpdate', 'getSettings'].includes(name);
    const operation = Promise.resolve().then(() => callback(args));
    if (tracks) activeOperations.add(operation);
    try { return await operation; } finally { activeOperations.delete(operation); }
  });
}
function bindAPI() {
  handle('getSettings', publicSettings);
  handle('saveSettings', saveSettings);
  handle('getUpdateState', () => updater.snapshot());
  handle('checkForUpdates', () => updater.checkForUpdates());
  handle('downloadUpdate', () => updater.downloadUpdate());
  handle('installUpdate', () => updater.installUpdate());
  handle('chooseFolder', async args => {
    const title = typeof args?.title === 'string' && args.title.trim() ? args.title.slice(0, 120) : '选择照片文件夹';
    const result = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', ...(args?.createDirectory === true ? ['createDirectory'] : [])] });
    if (result.canceled) return null;
    const stat = await fs.lstat(result.filePaths[0]);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('请选择真实文件夹，不能选择符号链接');
    const real = await fs.realpath(result.filePaths[0]);
    approvedRoots.add(real);
    return real;
  });
  handle('chooseEditor', async editor => {
    if (!['photoshop', 'lightroom'].includes(editor)) throw new Error('未知修图软件');
    const result = await dialog.showOpenDialog(win, { title: `选择 ${editor === 'photoshop' ? 'Photoshop' : 'Lightroom'} 应用`, properties: ['openFile'], ...(process.platform === 'darwin' ? { filters: [{ name: '应用', extensions: ['app'] }] } : {}) });
    if (result.canceled) return null;
    const chosen = await fs.realpath(result.filePaths[0]);
    await saveSettings({ editorPaths: { [editor]: chosen } });
    return chosen;
  });
  handle('scan', async root => {
    const chosen = await approvedFolder(root);
    const result = await library.scan(chosen);
    await saveSettings({ libraryRoot: chosen });
    mediaTokens.clear();
    return result;
  });
  handle('update', ({ ids, patch }) => library.update(ids, patch));
  handle('thumbnail', async ({ id, size }) => mediaURL(await library.thumbnail(id, Math.min(2400, Math.max(120, Number(size) || 600)))));
  handle('source', async ({ id, format }) => mediaURL(await library.source(id, format === 'raw' ? 'raw' : 'jpeg')));
  handle('analyzeColors', ({ ids }) => library.analyzeColors(ids));
  handle('similar', async args => library.similar({ ...args, directory: await approvedFolder(args.directory) }));
  handle('cancel', kind => library.cancel(kind));
  handle('importPhotos', async args => {
    const source = await approvedFolder(args.source);
    const destination = await approvedFolder(args.destination || settings.importDestination);
    const theme = String(args.theme || '').trim();
    if (!theme || /[\x00-\x1f/\\]/.test(theme) || theme === '.' || theme === '..') throw new Error('请填写有效主题名称');
    return library.importPhotos({ source, destination, theme });
  });
  handle('copySelected', async args => {
    const requested = args?.directory || args?.destination;
    if (typeof requested !== 'string' || !requested) throw new Error('请选择复制目标文件夹');
    const stat = await fs.lstat(requested);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('复制目标必须是真实文件夹，不能是符号链接');
    const directory = await approvedFolder(requested);
    const result = await library.copySelected({ ids: args.ids, directory, includeRaw: args.includeRaw ?? false });
    copyDestinations.add(result.directory);
    return result;
  });
  handle('cacheInfo', () => library.cacheInfo());
  handle('clearCache', () => library.clearCache());
  handle('syncPreview', async args => {
    const plan = await library.syncPreview({ directory: await approvedFolder(args.directory), ids: args.ids });
    syncPlans.set(plan.token, plan);
    return plan;
  });
  handle('syncFavorites', async ({ token }) => {
    if (!syncPlans.has(token)) throw new Error('同步预览已过期，请重新选择 SD 卡并核对');
    const result = await library.syncFavorites({ token });
    syncPlans.delete(token);
    if (result.batchDirectory) syncBatches.add(await fs.realpath(result.batchDirectory));
    return result;
  });
  handle('revealDirectory', async ({ directory }) => {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('请选择真实文件夹，不能选择符号链接');
    const real = await fs.realpath(directory);
    if (!syncBatches.has(real) && !(copyDestinations.has(real) && approvedRoots.has(real))) throw new Error('请选择本次复制目标或同步生成的待删目录');
    const error = await shell.openPath(real);
    if (error) throw new Error(error);
    return { opened: true };
  });
  handle('reveal', async ({ ids, format = 'both' }) => {
    const files = await library.authorizePaths(ids, format);
    if (!files.length) throw new Error('没有选中照片');
    if (process.platform === 'darwin') {
      const script = `ObjC.import('AppKit'); function run(argv) { var urls = argv.map(function(p) { return $.NSURL.fileURLWithPath(p); }); $.NSWorkspace.sharedWorkspace.activateFileViewerSelectingURLs(urls); }`;
      await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script, ...files]);
    } else if (process.platform === 'linux') {
      const uris = files.map(f => "'" + pathToFileURL(f).href.replace(/'/g, "\\'") + "'");
      try {
        await run('gdbus', ['call', '--session', '--dest', 'org.freedesktop.FileManager1', '--object-path', '/org/freedesktop/FileManager1', '--method', 'org.freedesktop.FileManager1.ShowItems', `[${uris.join(', ')}]`, '']);
      } catch { throw new Error('当前文件管理器不支持批量选中（需要 FileManager1，例如 GNOME Files 或 KDE Dolphin）'); }
    } else {
      files.forEach(f => shell.showItemInFolder(f));
    }
    return { count: files.length };
  });
  handle('openEditor', async ({ id, format = 'jpeg', editor = 'default' }) => {
    const files = await library.authorizePaths([id], format);
    if (!files.length) throw new Error(format === 'raw' ? '此照片没有 CR3' : '此照片没有 JPEG');
    const file = files[0];
    if (editor === 'default') {
      const error = await shell.openPath(file);
      if (error) throw new Error(error);
      return { opened: true };
    }
    if (!['photoshop', 'lightroom'].includes(editor)) throw new Error('未知修图软件');
    const application = settings.editorPaths[editor];
    if (!application) throw new Error('请先在设置里选择修图软件的位置');
    await fs.access(application);
    if (process.platform === 'darwin') await run('/usr/bin/open', ['-a', application, file]);
    else {
      const child = execFile(application, [file], { windowsHide: true });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
    }
    return { opened: true };
  });
  handle('trash', async ({ ids, format = 'both' }) => {
    const files = await library.authorizePaths(ids, format);
    if (!files.length) return { canceled: true };
    const choice = await dialog.showMessageBox(win, { type: 'warning', title: '移到废纸篓', message: `将 ${ids.length} 组照片、共 ${files.length} 个原文件移到废纸篓？`, detail: '包含选中的 JPEG 和 CR3。可以从系统废纸篓恢复。', buttons: ['取消', '移到废纸篓'], defaultId: 0, cancelId: 0 });
    if (choice.response !== 1) return { canceled: true };
    const trashed = [], failed = [];
    for (const file of files) {
      try { await shell.trashItem(file); trashed.push(file); } catch (e) { failed.push({ path: file, message: e.message }); }
    }
    if (settings.libraryRoot) await library.scan(settings.libraryRoot);
    return { canceled: false, count: trashed.length, failed };
  });
  handle('saveImage', async ({ dataUrl, suggestedName = '拾光拼图.jpg', overwriteId }) => {
    if (typeof dataUrl !== 'string' || dataUrl.length > 400_000_000 || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw new Error('无效的图像数据');
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    const sharp = require('sharp');
    await sharp(bytes, { limitInputPixels: 400_000_000 }).metadata();
    let target;
    if (overwriteId) {
      target = (await library.authorizePaths([overwriteId], 'jpeg'))[0];
      if (!target) throw new Error('只能覆盖 JPEG，CR3 请交给专业修图软件');
      const result = await dialog.showMessageBox(win, { type: 'warning', message: '覆盖原 JPEG？', detail: '此操作会替换原文件，画布导出的照片不保留原 EXIF。建议另存为。', buttons: ['取消', '覆盖'], defaultId: 0, cancelId: 0 });
      if (result.response !== 1) return { canceled: true };
    } else {
      const name = path.basename(suggestedName).replace(/[\x00-\x1f]/g, '');
      let chosen;
      if (qaOutput) {
        await fs.mkdir(path.resolve(qaOutput), { recursive: true });
        chosen = { canceled: false, filePath: path.join(path.resolve(qaOutput), name) };
      } else chosen = await dialog.showSaveDialog(win, { title: '保存新的照片', defaultPath: path.join(settings.libraryRoot || app.getPath('pictures'), name), filters: [{ name: 'JPEG 照片', extensions: ['jpg'] }, { name: 'PNG 图片', extensions: ['png'] }] });
      if (chosen.canceled) return { canceled: true };
      target = chosen.filePath;
      if (/\.cr3$/i.test(target)) throw new Error('不能覆盖 CR3 原片');
    }
    const output = /\.png$/i.test(target) ? await sharp(bytes).png().toBuffer() : await sharp(bytes).jpeg({ quality: 95, mozjpeg: true }).toBuffer();
    const temp = path.join(path.dirname(target), `.${path.basename(target)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try { await fs.writeFile(temp, output, { flag: 'wx' }); await fs.rename(temp, target); }
    finally { await fs.unlink(temp).catch(() => {}); }
    return { canceled: false, path: target };
  });
}
async function start() {
  await app.whenReady();
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  settings = { libraryRoot: '', importDestination: '', editorPaths: { photoshop: await detectEditor('photoshop'), lightroom: await detectEditor('lightroom') }, cacheLimitMB: 512, fontScale: 1.2, checkUpdatesAutomatically: true };
  try { settings = { ...settings, ...JSON.parse(await fs.readFile(settingsPath, 'utf8')) }; } catch {}
  // Existing libraries can revisit the guide in Settings without interrupting an upgrade.
  settings.onboardingCompleted = typeof settings.onboardingCompleted === 'boolean' ? settings.onboardingCompleted : Boolean(settings.libraryRoot);
  settings.fontScale = typeof settings.fontScale === 'number' && Number.isFinite(settings.fontScale) ? Math.min(1.5, Math.max(1, settings.fontScale)) : 1.2;
  settings.checkUpdatesAutomatically = typeof settings.checkUpdatesAutomatically === 'boolean' ? settings.checkUpdatesAutomatically : true;
  delete settings.currentVersion;
  for (const root of [settings.libraryRoot, settings.importDestination]) if (root) approvedRoots.add(root);
  if (verifyRoot && smoke) {
    const real = await fs.realpath(verifyRoot);
    approvedRoots.add(real);
    settings.libraryRoot = real;
  }
  if (qaOutput) {
    await fs.mkdir(path.resolve(qaOutput), { recursive: true });
    approvedRoots.add(await fs.realpath(qaOutput));
  }
  library = new PhotoLibrary({ userData: app.getPath('userData'), emit: payload => { if (win && !win.isDestroyed()) win.webContents.send('memory:progress', payload); } });
  await library.init();
  updater = new UpdateService({ app, disabled: smoke || demo, automatic: () => settings.checkUpdatesAutomatically, emit: payload => { if (win && !win.isDestroyed()) win.webContents.send('memory:update-state', payload); }, openInstaller: file => shell.openPath(file), beforeInstall: async () => {
    if (activeOperations.size) throw new Error('请等待照片处理和设置保存结束后再更新');
    installingUpdate = true;
    await settingsSaveChain;
    await library.saveChain;
  }, installFailed: () => { installingUpdate = false; }, quit: () => { app.quit(); } });
  await updater.init();
  const renderer = path.resolve(__dirname, '..', 'renderer');
  protocol.handle('memory-app', async request => {
    const url = new URL(request.url);
    const requested = path.resolve(renderer, '.' + decodeURIComponent(url.pathname));
    if (!requested.startsWith(renderer + path.sep) || url.host !== 'app') return new Response('Forbidden', { status: 403 });
    try { return await diskResponse(requested); } catch { return new Response('Not found', { status: 404 }); }
  });
  protocol.handle('memory-photo', async request => {
    const token = new URL(request.url).pathname.slice(1);
    const file = mediaTokens.get(token);
    if (!file) return new Response('Unknown photo', { status: 404 });
    try { return await diskResponse(file, true); } catch { return new Response('Unavailable', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !/^(memory-app:|memory-photo:|data:|blob:|devtools:)/.test(details.url) }));
  bindAPI();
  function createWindow() {
    const compact = process.argv.includes('--compact');
    win = new BrowserWindow({ title: '拾光屿 · 摄影回忆时光机', width: compact ? 900 : 1440, height: compact ? 680 : 960, minWidth: 860, minHeight: 600, show: true, backgroundColor: '#f1f3ee', ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 20 }, vibrancy: 'under-window' } : {}), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !smoke } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('memory-app://app/')) event.preventDefault(); });
    const query = new URLSearchParams();
    if (demo) query.set('demo', '1');
    if (smoke && !process.argv.includes('--onboarding')) query.set('skipOnboarding', '1');
    win.loadURL(`memory-app://app/index.html${query.size ? '?' + query.toString() : ''}`);
    win.webContents.once('did-finish-load', async () => {
      const updateIndex = process.argv.indexOf('--update-relaunch');
      if (updateIndex >= 0) {
        try {
          const usable = await waitForBootReady(() => {
            if (!win || win.isDestroyed()) return false;
            return win.webContents.executeJavaScript('window.__shiguangBootReady === true');
          });
          if (usable && win && !win.isDestroyed()) await updater.acknowledgeRelaunch(process.argv[updateIndex + 1]);
        } catch {}
      }
    });
    win.on('closed', () => { win = null; });
    if (smoke || screenshotPath) win.webContents.once('did-finish-load', async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1800));
        if (qaScript) console.log(JSON.stringify({ qa: await win.webContents.executeJavaScript(await fs.readFile(path.resolve(qaScript), 'utf8')) }));
        const state = await win.webContents.executeJavaScript(`({title:document.title,photos:document.querySelectorAll('.photo-card').length, text:document.body.innerText.slice(0,1800), bridge:!!window.timeMachine})`);
        if (screenshotPath) { await fs.mkdir(path.dirname(screenshotPath), { recursive: true }); await fs.writeFile(screenshotPath, (await win.webContents.capturePage()).toPNG()); }
        console.log(JSON.stringify(state));
      } catch (e) { console.error(e); exitStatus = 1; }
      finally { if (smoke) { closing = true; await library.close(); app.exit(exitStatus); } }
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: '拾光屿', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] }
  ]));
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
let closing = false;
app.on('before-quit', event => {
  if (library && !closing) {
    event.preventDefault();
    closing = true;
    updater?.stop();
    Promise.resolve(settingsSaveChain).catch(() => {}).then(() => library.close?.()).finally(() => app.quit());
  }
});
if (ownsInstance) start().catch(error => { console.error(error); app.exit(1); });
