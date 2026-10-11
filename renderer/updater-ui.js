'use strict';
(() => {
  const app = window.App;
  if (!app?.api) return;
  const api = app.api;
  const statuses = new Set(['idle', 'checking', 'available', 'upToDate', 'downloading', 'ready', 'installing', 'error']);
  let update = { status: 'idle', currentVersion: app.state.settings.currentVersion || '', latestVersion: null, support: 'manual', installSupported: false, progress: null, message: '' };
  let section = null, context = null, notice = null, dismissedVersion = null;
  let openingSettings = false, activeAction = false, failureAction = 'check', autoInstall = null, revision = 0;
  const supported = () => typeof api.getUpdateState === 'function' && typeof api.checkForUpdates === 'function';
  const deb = () => update.support === 'deb';
  const busy = () => activeAction || ['checking', 'downloading', 'installing'].includes(update.status);
  const version = value => value ? `v${value}` : '正在读取…';
  const bytes = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return '—';
    return number >= 1024 * 1024 ? `${(number / 1024 / 1024).toFixed(1)} MB` : `${Math.round(number / 1024)} KB`;
  };
  function apply(next) {
    if (!next || typeof next !== 'object') return;
    update = { ...update, ...next, status: statuses.has(next.status) ? next.status : update.status };
    render();
  }
  function inline(message = '') {
    if (!section?.isConnected) return;
    const node = section.querySelector('#update-error');
    node.textContent = message;
    node.hidden = !message;
  }
  function installAllowed(target, settingsContext) {
    if (!target?.isConnected || !settingsContext?.alive) return false;
    if (settingsContext.isDirty?.()) {
      inline('请先保存相册设置，再更新。未保存的字号或路径不会被丢弃。');
      document.getElementById('settings-save')?.focus({ preventScroll: true });
      return false;
    }
    const progress = document.getElementById('progress-section');
    if (app.state.scanning || progress && !progress.hidden || app.state.busy) {
      inline('请等待当前照片任务完成，再更新。');
      return false;
    }
    return true;
  }
  function failed(error, operation) {
    failureAction = operation;
    apply({ status: 'error', message: error?.message || String(error), progress: null });
  }
  async function check() {
    if (!supported() || busy()) return;
    inline(); activeAction = true; failureAction = 'check';
    apply({ status: 'checking', message: '', progress: null });
    try { apply(await api.checkForUpdates()); }
    catch (error) { failed(error, 'check'); }
    finally { activeAction = false; render(); }
  }
  async function install(target, settingsContext) {
    if (busy() || !(update.status === 'ready' || update.status === 'error' && failureAction === 'install') || !update.installSupported || !installAllowed(target, settingsContext)) return;
    inline(); activeAction = true; failureAction = 'install'; render();
    try { apply(await api.installUpdate()); }
    catch (error) { failed(error, 'install'); }
    finally { activeAction = false; render(); }
  }
  async function download(target, settingsContext, restart) {
    if (busy() || !update.installSupported || restart && !installAllowed(target, settingsContext)) return;
    inline(); activeAction = true; failureAction = 'download';
    const intent = { target, settingsContext, cancelled: false };
    if (restart) autoInstall = intent;
    render();
    try {
      apply(await api.downloadUpdate());
      if (restart && autoInstall === intent && !intent.cancelled && update.status === 'ready' && installAllowed(target, settingsContext)) {
        failureAction = 'install';
        apply(await api.installUpdate());
      }
    } catch (error) { failed(error, failureAction); }
    finally { if (autoInstall === intent) autoInstall = null; activeAction = false; render(); }
  }
  function renderSection() {
    if (!section?.isConnected) return;
    const find = selector => section.querySelector(selector);
    section.dataset.status = update.status;
    find('#update-current-version').textContent = version(update.currentVersion || context.settings.currentVersion);
    const descriptions = {
      idle: ['让拾光屿，陪你走得更远', '可以手动检查新版本。'],
      checking: ['正在查看新的光影', '检查更新期间，可以继续浏览照片。'],
      upToDate: ['已经是最新版本', '安心留住此刻，新的版本会在这里与你见面。'],
      available: [`发现新版本 ${version(update.latestVersion)}`, deb() ? '下载并校验后打开系统安装器，请按系统提示完成安装。' : '一键下载并校验，随后重启更新；应用会在原位置替换。'],
      downloading: ['正在下载更新', '可以继续看照片。关闭设置会保留下载，但取消自动重启。'],
      ready: ['更新已下载并校验完成', deb() ? '点击打开系统安装器，由系统完成安装。' : '点击会重启并更新；应用会在原位置替换。'],
      installing: [deb() ? '正在打开系统安装器' : api.isDemo ? '正在演示更新流程' : '正在重启并更新', deb() ? '请按系统安装器的提示完成安装。' : '精品收藏、标签和相册设置都会保留。'],
      error: ['更新暂未完成', update.message || '请检查网络连接，然后重试。'],
    };
    const [heading, description] = descriptions[update.status] || descriptions.idle;
    find('#update-status').textContent = heading;
    find('#update-description').textContent = !update.installSupported && ['available', 'ready'].includes(update.status) ? update.message || '当前安装方式暂不支持应用内更新，请使用正式安装包安装到可写的位置。' : deb() && update.status === 'ready' && update.message ? update.message : description;
    const progress = update.progress || {}, percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
    find('#update-progress-wrap').hidden = update.status !== 'downloading';
    find('#update-progress').value = percent;
    find('#update-progress-text').textContent = `${Math.round(percent)}% · ${bytes(progress.receivedBytes)} / ${bytes(progress.totalBytes)}`;
    find('#update-check').disabled = !supported() || busy();
    find('#update-check').textContent = update.status === 'checking' ? '正在检查…' : '检查更新';
    const primary = find('#update-action'), later = find('#update-download-only');
    primary.hidden = !['available', 'ready', 'error', 'downloading', 'installing'].includes(update.status);
    primary.disabled = busy() || !update.installSupported;
    later.hidden = !['available', 'error'].includes(update.status) || failureAction === 'install' && update.status === 'error';
    later.disabled = busy() || !update.installSupported;
    let action = update.status === 'ready' || update.status === 'error' && failureAction === 'install' ? 'install' : 'download';
    if (update.status === 'error' && failureAction === 'check') {
      action = 'check'; primary.disabled = busy() || !supported(); later.hidden = true;
    }
    primary.dataset.action = action;
    primary.textContent = update.status === 'downloading' ? '正在下载…' : update.status === 'installing' ? deb() ? '正在打开…' : '正在更新…' : action === 'check' ? '重新检查' : action === 'install' ? deb() ? '打开安装器' : '重启并更新' : update.status === 'error' ? deb() ? '重试下载并安装' : '重试更新并重启' : deb() ? '下载并打开安装器' : '一键更新并重启';
    find('#update-retained').textContent = '原片、精品收藏、标签与相册设置保留。';
    find('#update-demo-note').hidden = !api.isDemo;
    find('#update-auto').checked = app.state.settings.checkUpdatesAutomatically !== false;
  }
  function renderNotice() {
    if (!notice) {
      notice = document.createElement('aside');
      notice.id = 'update-notice'; notice.className = 'update-notice'; notice.setAttribute('role', 'status'); notice.hidden = true;
      notice.innerHTML = '<div class="update-notice-copy"><strong id="update-notice-title"></strong><span>为下一段旅程，准备新的拾光屿。</span></div><div class="update-notice-actions"><button class="button quiet" id="update-notice-view">查看更新</button><button class="update-notice-later" id="update-notice-later" aria-label="稍后提醒">稍后</button></div>';
      document.body.append(notice);
      notice.querySelector('#update-notice-view').onclick = openSettings;
      notice.querySelector('#update-notice-later').onclick = () => { dismissedVersion = update.latestVersion; renderNotice(); };
    }
    notice.hidden = !['available', 'ready'].includes(update.status) || !update.latestVersion || update.notify === false || dismissedVersion === update.latestVersion;
    notice.querySelector('#update-notice-title').textContent = update.status === 'ready' ? '更新已准备好，随时启程' : `拾光屿 ${version(update.latestVersion)} 已到来`;
  }
  function render() { renderSection(); renderNotice(); }
  function openSettings() {
    if (openingSettings) return;
    if (section?.isConnected) {
      section.scrollIntoView({ block: 'start', behavior: 'instant' });
      section.querySelector('#update-check').focus({ preventScroll: true });
      return;
    }
    if (document.getElementById('modal-root')?.children.length) {
      app.toast('请先保存或关闭当前窗口，再查看更新。');
      return;
    }
    openingSettings = true;
    app.run(async () => {
      try { await app.openSettings({ preserveModal: true }); }
      finally { openingSettings = false; }
    });
  }
  function mountSettings(root, options = {}) {
    const local = document.createElement('section');
    local.id = 'settings-updater'; local.className = 'settings-updater'; local.setAttribute('aria-label', '拾光屿版本与更新');
    local.innerHTML = '<div class="update-section-heading"><div><span class="update-eyebrow">SHIGUANG ISLE · 软件更新</span><h4>每一段光影，都值得更新</h4><span class="update-version-label">当前版本 <strong id="update-current-version"></strong></span></div><label class="update-auto-label"><span>启动时自动检查</span><input id="update-auto" type="checkbox" role="switch" aria-label="启动时自动检查更新"><i aria-hidden="true"></i></label></div><div class="update-status-copy"><strong id="update-status" aria-live="polite"></strong><p id="update-description"></p></div><div id="update-progress-wrap" class="update-progress-wrap" hidden><progress id="update-progress" max="100" value="0" aria-label="更新下载进度"></progress><span id="update-progress-text"></span></div><p id="update-error" class="update-error" role="alert" hidden></p><div class="update-section-actions"><button class="button quiet" id="update-check">检查更新</button><button class="button primary" id="update-action" hidden></button><button class="update-download-only" id="update-download-only" hidden>仅下载，稍后安装</button></div><p id="update-retained" class="update-retained"></p><p id="update-demo-note" class="update-demo-note" hidden>演示模式 · 只模拟更新，不联网或替换应用。</p>';
    root.querySelector('.modal-body').prepend(local);
    const localContext = { ...options, settings: options.settings || app.state.settings, alive: true };
    section = local; context = localContext;
    if (!update.currentVersion && localContext.settings.currentVersion) update.currentVersion = localContext.settings.currentVersion;
    local.querySelector('#update-check').onclick = check;
    local.querySelector('#update-action').onclick = () => {
      const action = local.querySelector('#update-action').dataset.action;
      if (action === 'check') check();
      else if (action === 'install') install(local, localContext);
      else download(local, localContext, true);
    };
    local.querySelector('#update-download-only').onclick = () => download(local, localContext, false);
    local.querySelector('#update-auto').onchange = async event => {
      const checkbox = event.target, previous = app.state.settings.checkUpdatesAutomatically !== false;
      checkbox.disabled = true; inline();
      try {
        const saved = await api.saveSettings({ checkUpdatesAutomatically: checkbox.checked });
        app.state.settings = { ...app.state.settings, ...saved };
      } catch (error) { checkbox.checked = previous; inline(`未能保存自动检查设置：${error.message || String(error)}`); }
      finally { checkbox.disabled = false; renderSection(); }
    };
    render();
    return () => {
      localContext.alive = false;
      if (autoInstall?.target === local) autoInstall.cancelled = true;
      if (section === local) { section = null; context = null; }
    };
  }
  // Subscribe before the initial request, independently of library scanning.
  // A late initial snapshot must not replace a newer event with stale state.
  api.onUpdateState?.(next => { revision++; apply(next); });
  if (supported()) {
    const initialRevision = revision;
    Promise.resolve(api.getUpdateState()).then(next => { if (revision === initialRevision) apply(next); }).catch(() => {});
  }
  window.UpdaterUI = { mountSettings, openSettings, current: () => ({ ...update }) };
})();
