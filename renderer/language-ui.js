'use strict';
(() => {
  const t=(value,args)=>window.I18n.t(value,args);
  async function choose(language){const settings=await App.api.saveSettings({language,languageChosen:true});App.state.settings={...App.state.settings,...settings};window.I18n.setLanguage(settings.language);return settings;}
  function ensureChoice(settings){
    if(settings.languageChosen===true)return Promise.resolve(settings);
    App.state.languageChoosing=true;
    return new Promise(resolve=>{
      const layer=document.createElement('div');layer.className='language-welcome';layer.dataset.i18nIgnore='';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','language-welcome-title');
      layer.innerHTML='<section class="language-welcome-card"><span class="language-sun" aria-hidden="true">☼</span><p class="language-eyebrow">SHIGUANG ISLE</p><h1 id="language-welcome-title">A home for every photograph.</h1><p class="language-welcome-subtitle">Choose your language to begin.<br><span>选择语言，开启你的摄影时光。</span></p><div class="language-choices"><button class="language-choice active" id="first-language-en" lang="en"><strong>English</strong><span>Continue in English →</span></button><button class="language-choice" id="first-language-zh" lang="zh-CN"><strong>中文</strong><span>使用中文开始 →</span></button></div><p class="language-welcome-note">You can change this anytime in Settings.<br>之后可在设置里随时切换。</p><p class="language-welcome-error" role="alert" hidden></p></section>';
      document.body.append(layer);const buttons=[...layer.querySelectorAll('button')];
      const select=async language=>{buttons.forEach(b=>b.disabled=true);try{const saved=await choose(language);App.state.languageChoosing=false;layer.remove();resolve(saved);}catch(error){const node=layer.querySelector('.language-welcome-error');node.hidden=false;node.textContent='Could not save your choice. Please try again. / 无法保存选择，请重试。';buttons.forEach(b=>b.disabled=false);}};
      layer.querySelector('#first-language-en').onclick=()=>select('en');layer.querySelector('#first-language-zh').onclick=()=>select('zh-CN');
      layer.addEventListener('keydown',event=>{if(event.key==='Tab'){const first=buttons[0],last=buttons[1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}if(event.key==='Escape')event.preventDefault();});buttons[0].focus();
    });
  }
  function mountSettings(node,settings){
    const field=document.createElement('div');field.className='field language-settings';field.innerHTML='<label>界面语言</label><div class="language-toggle" role="group" aria-label="界面语言"><button type="button" class="language-toggle-button" id="language-zh" lang="zh-CN" data-i18n-ignore>中文</button><button type="button" class="language-toggle-button" id="language-en" lang="en" data-i18n-ignore>English</button></div><small>语言切换会立即生效，并记住你的选择。</small><span class="language-save-status" role="status"></span>';
    node.querySelector('.modal-body').prepend(field);let busy=false;const buttons=[...field.querySelectorAll('button')];
    const refresh=()=>{buttons.forEach(button=>{const selected=(button.id==='language-zh'?'zh-CN':'en')===window.I18n.language();button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});window.I18n.apply(field);};
    const cleanup=window.I18n.onChange(refresh);refresh();
    for(const button of buttons)button.onclick=async()=>{if(busy)return;const language=button.id==='language-zh'?'zh-CN':'en';if(language===window.I18n.language())return;busy=true;buttons.forEach(b=>b.disabled=true);const status=field.querySelector('.language-save-status');try{await choose(language);status.textContent=t(language==='en'?'已切换为英文':'已切换为中文');}catch(error){status.textContent=t('语言保存失败，请重试。');}finally{busy=false;buttons.forEach(b=>b.disabled=false);refresh();}};
    return cleanup;
  }
  window.LanguageUI={ensureChoice,mountSettings};
})();
