/* UI integration coverage with the synthetic bridge only. No network, package
 * download, installation, user photographs or production settings are used. */
(async () => {
  const checks = [];
  const assert = (ok, label, details) => { if (!ok) throw new Error(label + (details ? ` ${JSON.stringify(details)}` : '')); checks.push(label); };
  const el = id => document.getElementById(id);
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = async test => {
    for (let i = 0; i < 220; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
    throw new Error(`Update UI timeout: ${test.toString()}; status=${window.UpdaterUI?.current().status}`);
  };
  await wait(() => window.App?.api.isDemo && window.UpdaterUI && App.state.settingsReady && !App.state.scanning);
  const api = App.api;
  const original = Object.fromEntries(['checkForUpdates','downloadUpdate','installUpdate','saveSettings','getSettings'].map(key => [key, api[key]]));
  const originalSettings = await api.getSettings(), initialPhotos = JSON.stringify(App.state.photos);
  const emit = patch => api.qaEmitUpdateState(patch);
  const available = (patch = {}) => emit({ status:'available',currentVersion:'1.0.7',latestVersion:'1.0.8',support:'mac',installSupported:true,message:'',progress:null,notify:undefined,...patch });
  const close = async () => { App.closeModal(); await frames(); };
  const open = async () => { await App.openSettings(); await wait(() => el('settings-updater')); await new Promise(resolve => setTimeout(resolve, 35)); await frames(); };
  const clean = async () => { await close(); api.checkForUpdates=original.checkForUpdates;api.downloadUpdate=original.downloadUpdate;api.installUpdate=original.installUpdate;api.saveSettings=original.saveSettings;api.getSettings=original.getSettings; };
  const hit = node => {
    const r=node.getBoundingClientRect(), target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return r.width>0 && r.height>0 && r.top>=0 && r.bottom<=innerHeight+1 && (target===node || node.contains(target));
  };
  const reachable = async (id,label) => {
    const node=el(id);node.scrollIntoView({block:'nearest',behavior:'instant'});await frames();
    assert(hit(node),label,{id,rect:node.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]});
  };
  const setFont = value => { el('setting-font-scale').value=String(value);el('setting-font-scale').dispatchEvent(new Event('input',{bubbles:true})); };
  const clicked = id => { const node=el(id);node.focus({preventScroll:true});node.click(); };
  let downloadCalls=0, installCalls=0, checkCalls=0, settingsCalls=[];
  const captureSave = async patch => {settingsCalls.push({...patch});return original.saveSettings(patch);};
  const pendingDownload = () => {
    let resolve;
    const promise = new Promise(done => {resolve=done;});
    api.downloadUpdate=async()=>{downloadCalls++;emit({status:'downloading',message:'',progress:{receivedBytes:3e6,totalBytes:10e6,percent:30}});return promise;};
    return () => resolve(emit({status:'ready',progress:{receivedBytes:10e6,totalBytes:10e6,percent:100},message:''}));
  };
  try {
    assert(api.isDemo && typeof api.qaEmitUpdateState==='function','Updater tests are confined to the synthetic demo bridge');
    assert(!el('update-notice') || el('update-notice').hidden,'Initial idle state creates no disruptive update notice');
    available({notify:false});assert(el('update-notice').hidden,'A manual or previously announced update does not create an extra banner');
    available({notify:true});assert(!el('update-notice').hidden,'A first automatic update notification is shown');
    const scroll=el('main-scroll'),scrollTarget=Math.min(180,scroll.scrollHeight-scroll.clientHeight);
    // scrollTop assignment inherits the gallery's CSS smooth behavior. Finish
    // positioning before measuring whether an update notice itself moves it.
    scroll.scrollTo({top:scrollTarget,behavior:'instant'});
    await wait(()=>scroll.scrollTop===scrollTarget);await frames();
    el('search').focus({preventScroll:true});
    const scrollTop=scroll.scrollTop,focus=document.activeElement;
    App.state.selected.add(App.state.photos[0].id);
    available();await frames();
    assert(!el('update-notice').hidden && document.activeElement===focus && scroll.scrollTop===scrollTop,'Available update appears without taking focus or moving the gallery',{
      noticeVisible:!el('update-notice').hidden,
      focus:{unchanged:document.activeElement===focus,before:focus?.id,after:document.activeElement?.id},
      scroll:{unchanged:scroll.scrollTop===scrollTop,before:scrollTop,after:scroll.scrollTop}
    });
    assert(App.state.selected.has(App.state.photos[0].id) && !el('modal-root').children.length,'Update notice preserves photo selection and leaves the gallery open');
    clicked('update-notice-later');assert(el('update-notice').hidden,'Later dismisses the current version');
    available();assert(el('update-notice').hidden,'The dismissed version stays unobtrusive for this session');
    available({latestVersion:'1.0.9'});assert(!el('update-notice').hidden,'A different new version may be announced');
    let closed=0;
    const work=App.modal({title:'合成未保存工作台',body:'<textarea id="update-work">合成未保存内容</textarea>',onClose:()=>closed++});
    await new Promise(resolve=>setTimeout(resolve,35));el('update-work').focus({preventScroll:true});
    clicked('update-notice-view');
    assert(work.isConnected && closed===0 && el('update-work').value==='合成未保存内容' && !el('settings-updater'),'Viewing an update never destroys an existing unsaved work modal');
    await close();available();
    let releaseSettings, readCount=0;
    const delayedSettings=new Promise(resolve=>{releaseSettings=resolve;});
    api.getSettings=async()=>{readCount++;return delayedSettings;};
    clicked('update-notice-view');clicked('update-notice-view');el('settings-button').click();
    assert(readCount===1,'Duplicate update/settings clicks share one pending settings request');
    let lateClosed=0;
    const lateWork=App.modal({title:'合成迟到设置测试工作台',body:'<textarea id="update-late-work">待保留的合成编辑</textarea>',onClose:()=>lateClosed++});
    releaseSettings(await original.getSettings());
    await wait(()=>!App.state.settingsOpening);await frames();
    assert(lateWork.isConnected && lateClosed===0 && el('update-late-work').value==='待保留的合成编辑' && !el('settings-updater'),'A delayed settings response does not replace a newly opened unsaved work modal');
    api.getSettings=original.getSettings;await close();
    clicked('update-notice-view');await wait(()=>el('settings-updater'));
    assert(el('update-current-version').textContent==='v1.0.7' && el('update-auto').checked,'Settings shows the installed version and automatic checking enabled by default');
    assert(el('update-action').textContent==='一键更新并重启' && /下载.*校验/.test(el('update-description').textContent),'The primary action states that one click downloads, verifies and restarts');
    assert(/精品收藏.*标签.*设置/.test(el('update-retained').textContent),'The update panel explains that user collections, tags and settings are preserved');
    assert(!el('update-demo-note').hidden && /不联网/.test(el('update-demo-note').textContent),'Demo update flows are clearly labelled as simulation');
    const body=el('settings-updater').closest('.modal-body');body.scrollTop=body.scrollHeight;
    clicked('update-notice-view');await frames();
    assert(el('settings-updater').getBoundingClientRect().top>=body.getBoundingClientRect().top-1,'Opening the update notice reuses an existing settings dialog and reveals its update section');
    api.saveSettings=captureSave;
    el('update-auto').checked=false;el('update-auto').dispatchEvent(new Event('change',{bubbles:true}));
    await wait(()=>!el('update-auto').disabled);
    assert(settingsCalls.length===1 && JSON.stringify(settingsCalls[0])==='{"checkUpdatesAutomatically":false}','Automatic checking saves only the boolean preference');
    const saved=await api.getSettings();
    assert(saved.checkUpdatesAutomatically===false && saved.libraryRoot===originalSettings.libraryRoot && saved.fontScale===originalSettings.fontScale && JSON.stringify(saved.editorPaths)===JSON.stringify(originalSettings.editorPaths),'Saving automatic checking preserves existing library, editor and font settings');
    api.saveSettings=async()=>{throw new Error('合成设置写入失败');};
    el('update-auto').checked=true;el('update-auto').dispatchEvent(new Event('change',{bubbles:true}));
    await wait(()=>!el('update-auto').disabled);
    assert(!el('update-auto').checked && !el('update-error').hidden && /写入失败/.test(el('update-error').textContent),'Preference save failure restores the prior switch and shows a useful error');
    api.saveSettings=captureSave;el('update-auto').checked=true;el('update-auto').dispatchEvent(new Event('change',{bubbles:true}));
    await wait(()=>!el('update-auto').disabled);
    assert(el('update-auto').checked && (await api.getSettings()).checkUpdatesAutomatically,'Automatic checking can be retried successfully without saving other fields');
    api.checkForUpdates=async()=>{checkCalls++;emit({status:'checking'});await new Promise(resolve=>setTimeout(resolve,80));throw new Error('合成网络失败');};
    clicked('update-check');assert(el('update-check').disabled,'Checking disables repeat check requests');clicked('update-check');
    await wait(()=>el('settings-updater').dataset.status==='error' && !el('update-action').disabled);
    assert(checkCalls===1 && el('update-action').textContent==='重新检查' && /网络失败/.test(el('update-description').textContent),'A failed check reports the error and offers a check retry');
    api.checkForUpdates=async()=>{checkCalls++;return available();};clicked('update-action');
    await wait(()=>el('settings-updater').dataset.status==='available' && !el('update-action').disabled);
    assert(checkCalls===2,'Check retry executes the actual bridge method');
    api.downloadUpdate=async()=>{downloadCalls++;return emit({status:'ready'});};
    api.installUpdate=async()=>{installCalls++;return emit({status:'upToDate',latestVersion:null});};
    setFont(1.5);clicked('update-action');await frames();
    assert(downloadCalls===0 && installCalls===0 && /先保存/.test(el('update-error').textContent),'Unsaved font changes prevent restart and are not silently lost');
    setFont(1.2);el('setting-photoshop').value='合成尚未保存的修图程序';clicked('update-action');await frames();
    assert(downloadCalls===0 && /先保存/.test(el('update-error').textContent),'Unsaved application paths also prevent immediate update');
    await close();
    assert(App.state.settings.fontScale===1.2 && Number(getComputedStyle(document.documentElement).getPropertyValue('--font-scale'))===1.2,'Closing update settings retains the original font cancellation behavior');
    await clean();available();await open();
    api.installUpdate=async()=>{installCalls++;emit({status:'installing'});await new Promise(resolve=>setTimeout(resolve,60));return emit({status:'upToDate',latestVersion:null,currentVersion:'1.0.8'});};
    const finish=pendingDownload();clicked('update-action');
    await wait(()=>el('settings-updater').dataset.status==='downloading');
    assert(el('update-action').disabled && el('update-check').disabled && !el('update-progress-wrap').hidden && el('update-progress').value===30 && /30%/.test(el('update-progress-text').textContent),'A real download state shows percentage, byte progress and disabled duplicate actions');
    emit({status:'downloading',progress:{receivedBytes:8e6,totalBytes:10e6,percent:80}});
    assert(el('update-progress').value===80 && /80%/.test(el('update-progress-text').textContent),'Download progress events refresh the visible progress bar');
    finish();await wait(()=>el('settings-updater').dataset.status==='installing');
    assert(el('update-action').disabled && /更新/.test(el('update-status').textContent),'Installing remains disabled and explicitly visible');
    await wait(()=>el('settings-updater').dataset.status==='upToDate' && !el('update-check').disabled);
    assert(downloadCalls===1 && installCalls===1 && el('update-current-version').textContent==='v1.0.8','One explicit click invokes download then installation exactly once');
    assert(el('update-notice').hidden && el('update-action').hidden,'Up-to-date state stays quiet and hides unnecessary install actions');
    await clean();available();await open();
    api.downloadUpdate=async()=>{downloadCalls++;throw new Error('合成下载中断');};clicked('update-action');
    await wait(()=>el('settings-updater').dataset.status==='error' && !el('update-action').disabled);
    assert(/重试/.test(el('update-action').textContent) && /下载中断/.test(el('update-description').textContent),'Interrupted download offers a clear retry action');
    api.downloadUpdate=async()=>{downloadCalls++;return emit({status:'ready'});};api.installUpdate=async()=>{installCalls++;return emit({status:'upToDate',latestVersion:null});};
    clicked('update-action');await wait(()=>el('settings-updater').dataset.status==='upToDate' && !el('update-check').disabled);
    assert(downloadCalls===3 && installCalls===2,'Download retry reaches installation through the one-click flow');
    await clean();available();await open();
    let retryAttempts=0;api.downloadUpdate=async()=>emit({status:'ready'});api.installUpdate=async()=>{retryAttempts++;if(retryAttempts===1)throw new Error('合成安装器暂不可用');return emit({status:'upToDate',latestVersion:null});};
    clicked('update-action');await wait(()=>el('settings-updater').dataset.status==='error' && !el('update-action').disabled);
    assert(el('update-action').dataset.action==='install' && /重启并更新/.test(el('update-action').textContent),'Installation failure keeps a direct installation retry');
    clicked('update-action');await wait(()=>el('settings-updater').dataset.status==='upToDate' && !el('update-check').disabled);
    assert(retryAttempts===2,'Installation retry invokes the bridge again rather than silently doing nothing');
    await clean();available();await open();
    const finishClosed=pendingDownload();api.installUpdate=async()=>{installCalls++;return emit({status:'upToDate',latestVersion:null});};
    const installsBeforeClose=installCalls;clicked('update-action');await wait(()=>el('settings-updater').dataset.status==='downloading');await close();finishClosed();
    await wait(()=>UpdaterUI.current().status==='ready');await new Promise(resolve=>setTimeout(resolve,60));
    assert(installCalls===installsBeforeClose && !el('settings-updater'),'Closing settings cancels automatic restart while leaving the download ready');
    await open();assert(el('update-action').textContent==='重启并更新' && !el('update-action').disabled,'Reopening settings offers an explicit restart for a previously downloaded update');
    clicked('update-action');await wait(()=>el('settings-updater').dataset.status==='upToDate' && !el('update-check').disabled);
    assert(installCalls===installsBeforeClose+1,'Only the new explicit restart click installs a retained download');
    await clean();available();await open();
    const finishDirty=pendingDownload();const installsBeforeDirty=installCalls;api.installUpdate=async()=>{installCalls++;return emit({status:'upToDate',latestVersion:null});};
    clicked('update-action');await wait(()=>el('settings-updater').dataset.status==='downloading');setFont(1.5);finishDirty();
    await wait(()=>el('settings-updater').dataset.status==='ready' && !el('update-action').disabled);
    assert(installCalls===installsBeforeDirty && /先保存/.test(el('update-error').textContent),'Editing settings during download prevents its eventual automatic restart');
    await clean();available();await open();
    const finishOnly=pendingDownload();const beforeOnly=installCalls;api.installUpdate=async()=>{installCalls++;return emit({status:'upToDate',latestVersion:null});};
    clicked('update-download-only');await wait(()=>el('settings-updater').dataset.status==='downloading');finishOnly();
    await wait(()=>el('settings-updater').dataset.status==='ready' && !el('update-action').disabled);
    assert(installCalls===beforeOnly && el('update-action').textContent==='重启并更新','Download-only respects the user’s decision to install later');
    emit({status:'ready',installSupported:false,message:'合成只读安装位置'});
    const beforeUnsupported=installCalls;clicked('update-action');await frames();
    assert(el('update-action').disabled && installCalls===beforeUnsupported && /只读/.test(el('update-description').textContent),'Unsupported installation clearly explains the limit and cannot call install');
    available({support:'deb'});
    assert(el('update-action').textContent==='下载并打开安装器' && /系统安装器/.test(el('update-description').textContent) && !/重启|原位置/.test(el('update-description').textContent),'Linux deb update names the system installer and does not promise app replacement');
    emit({status:'ready'});
    assert(el('update-action').textContent==='打开安装器' && /系统/.test(el('update-description').textContent),'Downloaded Linux deb offers opening the installer without promising restart');
    emit({status:'ready',message:'已打开系统安装器；请完成安装后手动重新打开时光杂货店'});
    assert(/已打开系统安装器/.test(el('update-description').textContent) && /手动重新打开/.test(el('update-description').textContent),'Linux deb displays the installer result and manual relaunch instructions from the backend');
    await clean();
    for (const font of [1.2,1.5]) {
      await original.saveSettings({fontScale:font});App.state.settings.fontScale=font;App.applyFontScale(font);available();await open();
      const panel=el('settings-updater'),modal=panel.closest('.modal'),modalBody=panel.closest('.modal-body');
      assert(panel.scrollWidth<=panel.clientWidth+1 && modalBody.scrollWidth<=modalBody.clientWidth+1 && modal.scrollWidth<=modal.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth+1,`${font*100}% update settings wraps within the dialog and viewport`);
      assert(parseFloat(getComputedStyle(el('update-description')).fontSize)>=13 && parseFloat(getComputedStyle(el('update-status')).fontSize)>=14,`${font*100}% essential update text stays readable`);
      await reachable('update-auto',`${font*100}% automatic checking switch is reachable`);
      await reachable('update-check',`${font*100}% manual check is reachable`);
      await reachable('update-action',`${font*100}% update action is reachable`);
      await reachable('settings-save',`${font*100}% settings save footer remains reachable`);
      await reachable('setting-font-scale',`${font*100}% ordinary font settings remain reachable beneath the update panel`);
      await close();
    }
    // Deliberate in-memory failure proves our flow check detects a disconnected
    // control, without touching application files or waiting for a real install.
    available();await open();const action=el('update-action'),handler=action.onclick;action.onclick=()=>{};
    let negativeInvocations=0;api.downloadUpdate=async()=>{negativeInvocations++;return emit({status:'ready'});};
    clicked('update-action');await frames();
    assert(negativeInvocations===0 && UpdaterUI.current().status==='available','Negative control identifies a disconnected update action');
    action.onclick=handler;api.installUpdate=async()=>emit({status:'upToDate',latestVersion:null});clicked('update-action');
    await wait(()=>UpdaterUI.current().status==='upToDate' && !el('update-check').disabled);
    assert(negativeInvocations===1,'Restoring the action restores the real bridge invocation');
    assert(JSON.stringify(App.state.photos)===initialPhotos,'All updater flows leave synthetic photo metadata intact');
  } finally {
    await clean();await original.saveSettings({fontScale:originalSettings.fontScale,checkUpdatesAutomatically:originalSettings.checkUpdatesAutomatically});
    App.state.settings=await api.getSettings();App.applyFontScale(originalSettings.fontScale);App.state.selected.clear();
    emit({status:'idle',currentVersion:'1.0.7',latestVersion:null,support:'mac',installSupported:true,message:'',progress:null});el('toast-root').replaceChildren();
  }
  return {passed:checks.length,checks,viewport:{width:innerWidth,height:innerHeight}};
})();
