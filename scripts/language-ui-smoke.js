(async()=>{
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),checks=[];
  const assert=(value,name)=>{if(!value)throw new Error(name);checks.push(name);};
  const wait=async(predicate,name)=>{for(let i=0;i<200;i++){if(predicate())return;await sleep(30);}throw new Error(name);};
  await wait(()=>window.App&&window.I18n&&window.LanguageUI,'language modules available');await I18n.ready;
  const phase=window.__qaLanguagePhase||'fresh-zh';
  if(phase.startsWith('fresh-')){
    await wait(()=>document.querySelector('.language-welcome'),'first launch language chooser');
    const initial=await App.api.getSettings();assert(initial.language==='en'&&initial.languageChosen===false,'fresh default is English without prior language choice');
    assert(document.querySelector('.language-eyebrow').textContent==='SHUTTER COVE','first language chooser uses Shutter Cove branding');
    assert(document.documentElement.lang==='en','fresh document starts in English');assert(!document.querySelector('.onboarding-backdrop'),'language chooser precedes onboarding');assert(!App.state.settingsReady,'gallery initialization waits for choice');
    assert(document.activeElement.id==='first-language-en','English choice has default keyboard focus');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!!document.querySelector('.language-welcome'),'Escape cannot bypass required language choice');
    const realApi=App.api;App.api={...realApi,saveSettings:async()=>{throw new Error('Synthetic write failure');}};document.querySelector('#first-language-en').click();await wait(()=>!document.querySelector('.language-welcome-error').hidden,'language save failure displayed');assert(!!document.querySelector('.language-welcome')&&App.state.languageChoosing,'failed choice keeps required chooser open');assert(!document.querySelector('.onboarding-backdrop'),'failed choice cannot start onboarding');assert((await realApi.getSettings()).languageChosen===false,'failed choice is not persisted');assert([...document.querySelectorAll('.language-choice')].every(button=>!button.disabled),'failed choice allows retry');App.api=realApi;
    const choice=phase==='fresh-zh'?'zh-CN':'en';document.querySelector(choice==='en'?'#first-language-en':'#first-language-zh').click();
    await wait(()=>App.state.settingsReady&&!document.querySelector('.language-welcome'),'language choice persisted before app ready');
    const saved=await App.api.getSettings();assert(saved.language===choice&&saved.languageChosen===true,'first language choice saved to profile');assert(document.documentElement.lang===choice,'chosen language applied');
    await wait(()=>document.querySelector('.onboarding-backdrop'),'onboarding begins after language choice');
    assert(document.querySelector('#onboarding-step').textContent.includes(choice==='en'?'Welcome':'欢迎'),'onboarding uses chosen language');
    document.querySelector('#onboarding-skip')?.click();await sleep(100);
  }else{
    await wait(()=>App.state.settingsReady,'existing profile ready');
    assert(!document.querySelector('.language-welcome'),'existing profile bypasses first choice');const saved=await App.api.getSettings();
    const language=phase==='legacy'?'zh-CN':phase==='restart-en'?'en':'zh-CN';assert(saved.language===language,'existing or restarted profile retains intended language');assert(document.documentElement.lang===language,'persisted language applied on restart');
    await App.openSettings();const modal=document.querySelector('.album-settings');assert(!!modal,'settings opened');
    const title=modal.querySelector('h3');assert(title?.textContent===I18n.t('相册设置'),'settings translated');
    const draft=modal.querySelector('#setting-photoshop');draft.value='Draft-unchanged-中文';draft.focus();const photosBefore=App.state.photos.map(p=>({id:p.id,favorite:p.favorite,tags:p.tags,theme:p.theme}));
    document.querySelector(language==='en'?'#language-zh':'#language-en').click();await wait(()=>document.documentElement.lang!==language,'one click language switch');
    assert(draft.value==='Draft-unchanged-中文','unsaved settings draft preserved');assert(document.querySelector('.album-settings')===modal,'language switch does not recreate settings modal');
    const next=await App.api.getSettings();assert(next.language===(language==='en'?'zh-CN':'en')&&next.languageChosen===true,'switch autosaves without Save Settings');assert(next.fontScale===saved.fontScale&&next.libraryRoot===saved.libraryRoot&&JSON.stringify(next.editorPaths)===JSON.stringify(saved.editorPaths),'unrelated saved settings preserved');
    assert(JSON.stringify(photosBefore)===JSON.stringify(App.state.photos.map(p=>({id:p.id,favorite:p.favorite,tags:p.tags,theme:p.theme}))),'favorites tags themes and index retained');
    assert(document.querySelector('.language-toggle-button.active').id===(next.language==='en'?'language-en':'language-zh'),'active language button updates');
    App.closeModal();
  }
  return {passed:checks.length,checks,phase,language:I18n.language()};
})()
