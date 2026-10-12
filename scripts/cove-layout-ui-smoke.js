/* Native renderer layout acceptance. Uses only the isolated synthetic demo album. */
(async () => {
  const checks = [], el = id => document.getElementById(id);
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const assert = (ok, label, detail) => { if (!ok) throw new Error(label + (detail ? JSON.stringify(detail) : '')); checks.push(label); };
  const wait = async test => { for (let i = 0; i < 500; i++) { if (test()) return; await pause(20); } throw new Error('Layout wait timed out'); };
  await wait(() => window.App?.state.settingsReady && App.state.photos.length === 16 && window.I18n);
  assert(App.api.isDemo, 'Only synthetic demo photos used');
  assert([...document.styleSheets].some(s => s.href?.endsWith('/cove-design.css')), 'Refined design stylesheet loaded');
  const bounds = () => document.documentElement.scrollWidth <= innerWidth + 1 && el('main-scroll').scrollWidth <= el('main-scroll').clientWidth + 1;
  const contained = (node, parent) => { const a = node.getBoundingClientRect(), b = parent.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; };
  const textRects = node => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), rects = []; let text;
    while ((text = walker.nextNode())) for (let index = 0; index < text.length; index++) {
      if (/\s/.test(text.data[index])) continue;
      const range = document.createRange(); range.setStart(text, index); range.setEnd(text, index + 1);
      rects.push(range.getBoundingClientRect());
    }
    return rects;
  };
  const textContained = (node, parent) => {
    const box = parent.getBoundingClientRect();
    return textRects(node).every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
  };
  for (const language of ['zh-CN', 'en']) {
    I18n.setLanguage(language);
    for (const font of [1.2, 1.5]) {
      App.applyFontScale(font); await paint(); await pause(500);
      const brand = document.querySelector('.brand strong'), sidebar = document.querySelector('.sidebar');
      const hero = document.querySelector('.hero'), heroCopy = document.querySelector('.hero-copy');
      const heroParts = ['.eyebrow', 'h1', 'p', '.hero-bottom'].map(selector => heroCopy.querySelector(selector));
      assert(heroParts.every(part => textContained(part, heroCopy)) && heroParts.every(part => textContained(part, hero)), language + ' hero at ' + font + ' shows every line without clipping');
      assert(heroParts.slice(1).every((part, index) => part.getBoundingClientRect().top >= heroParts[index].getBoundingClientRect().bottom - 1), language + ' hero at ' + font + ' has no overlapping title, description or statistics');
      assert(bounds(), language + ' gallery ' + font + ' has no horizontal overflow');
      assert(contained(brand, sidebar), language + ' wordmark ' + font + ' remains inside sidebar');
      const title = brand.querySelector('.brand-title'), caption = brand.querySelector('.brand-caption');
      assert(brand.scrollWidth <= brand.clientWidth + 1 && title.scrollWidth <= title.clientWidth + 1 && caption.scrollWidth <= caption.clientWidth + 1, language + ' wordmark ' + font + ' does not clip', {scrollWidth:brand.scrollWidth,clientWidth:brand.clientWidth,rect:brand.getBoundingClientRect().toJSON(),font:getComputedStyle(brand).font,subtitle:caption.getBoundingClientRect().toJSON()});
      if (language === 'zh-CN') {
        assert(title.textContent === '时光杂货店', 'Updated Chinese wordmark');
        const tops = textRects(title).map(rect => rect.top);
        const onOneLine = tops.every(top => Math.abs(top - tops[0]) < 1);
        const twoThenThree = Math.abs(tops[0] - tops[1]) < 1 && tops[2] > tops[0] && tops.slice(2).every(top => Math.abs(top - tops[2]) < 1);
        assert(onOneLine || twoThenThree, 'Chinese wordmark is one line or exactly 时光 / 杂货店 at ' + font, tops);
      }
      el('select-mode').click(); el('select-all').click(); await paint();
      const bar = el('selection-bar');
      assert(bar.scrollWidth <= bar.clientWidth + 1, language + ' selection bar ' + font + ' wraps without overflow');
      el('clear-selection').click();
      await App.openSettings();
      const scaleInput = el('setting-font-scale');
      scaleInput.value = String(font);
      scaleInput.dispatchEvent(new Event('input', { bubbles: true }));
      await paint();
      const modal = document.querySelector('.modal');
      assert(Number(getComputedStyle(document.documentElement).getPropertyValue('--font-scale')) === font && modal.scrollWidth <= modal.clientWidth + 1 && modal.querySelector('.modal-body').scrollWidth <= modal.querySelector('.modal-body').clientWidth + 1, language + ' settings at actual ' + font + ' fits');
      App.closeModal();
    }
  }
  // Reproduce the CI's 107 px title budget independently of window size.
  // Persistent sidebars consume different scrollbar widths across macOS/Linux.
  const sidebar = document.querySelector('.sidebar'), copy = document.querySelector('.brand-copy');
  const priorOverflow = sidebar.style.overflowY, priorMaxWidth = copy.style.maxWidth;
  sidebar.style.overflowY = 'scroll';
  for (const budget of [107, 96]) for (const language of ['zh-CN', 'en']) {
    I18n.setLanguage(language);
    for (const font of [1.2, 1.5]) {
      App.applyFontScale(font); copy.style.maxWidth = budget + 'px'; await paint();
      const brand = copy.querySelector('strong'), title = brand.querySelector('.brand-title'), caption = brand.querySelector('.brand-caption');
      assert(copy.clientWidth <= budget && brand.scrollWidth <= brand.clientWidth + 1 && textContained(title, brand) && textContained(caption, brand), language + ' real text fits ' + budget + ' px with persistent scrollbar at ' + font, {brand:brand.getBoundingClientRect().toJSON(),scrollWidth:brand.scrollWidth,titleFont:getComputedStyle(title).font,captionFont:getComputedStyle(caption).font});
      if (language === 'zh-CN') {
        const tops = textRects(title).map(rect => rect.top);
        assert(tops.length === 5 && Math.abs(tops[0] - tops[1]) < 1 && tops[2] > tops[0] && tops.slice(2).every(top => Math.abs(top - tops[2]) < 1), 'Forced narrow Chinese title breaks only 时光 / 杂货店 at ' + budget + ' px and ' + font, tops);
      } else assert(title.textContent === 'Shutter Cove', 'English title survives narrow Chinese/English switching');
    }
  }
  copy.style.maxWidth = priorMaxWidth; sidebar.style.overflowY = priorOverflow;
  const settledTitle = copy.querySelector('.brand-title'); let titleMutations = 0;
  const settleObserver = new MutationObserver(records => { titleMutations += records.length; });
  settleObserver.observe(settledTitle, { childList: true, characterData: true, subtree: true });
  await pause(60); titleMutations = 0; await pause(220); settleObserver.disconnect();
  assert(titleMutations === 0, 'Brand formatting and localization settle without a mutation loop');
  for (const language of ['zh-CN', 'en']) {
    I18n.setLanguage(language);
    for (const font of [1.2, 1.5]) {
      App.applyFontScale(font); Onboarding.show(); await paint();
      const intro = document.querySelector('.onboarding-dialog');
      for (let step = 0; step < 5; step++) {
        assert(intro.scrollWidth <= intro.clientWidth + 1 && intro.querySelector('.onboarding-body').scrollWidth <= intro.querySelector('.onboarding-body').clientWidth + 1, language + ' onboarding step ' + step + ' ' + font + ' fits');
        assert(contained(intro.querySelector('.onboarding-wordmark'), intro), language + ' guide wordmark ' + font + ' is contained');
        if (step < 4) { el('onboarding-next').click(); await paint(); }
      }
      el('onboarding-finish').click(); await wait(() => !document.querySelector('.onboarding-dialog'));
    }
  }
  I18n.setLanguage('zh-CN'); App.applyFontScale(1.5); await paint();
  document.querySelector('.photo-card').click(); await wait(() => document.querySelector('.photo-detail')); await pause(800);
  const detail = document.querySelector('.photo-detail'), body = detail.querySelector('.modal-body');
  assert(detail.scrollWidth <= detail.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1, '150% photo detail fits');
  assert(getComputedStyle(document.querySelector('.preview-frame img')).filter === 'none', 'Detail photo is not blurred or recolored');
  App.closeModal(); await pause(450);
  App.applyFontScale(1.2);
  el('select-mode').click(); App.state.photos.slice(0, 4).forEach(p => App.state.selected.add(p.id)); App.render();
  el('batch-collage').click(); await wait(() => el('collage-background-hex')); await pause(300);
  for (const language of ['zh-CN', 'en']) {
    I18n.setLanguage(language);
    for (const font of [1.2, 1.5]) {
      App.applyFontScale(font); await paint();
      const modal = document.querySelector('.collage-studio'), body = modal.querySelector('.modal-body');
      assert(modal.scrollWidth <= modal.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1, language + ' collage ' + font + ' has no overflow');
      for (const id of ['collage-background-hex', 'collage-text-color-hex']) {
        const hex = el(id), parent = hex.closest('.collage-color-inputs');
        assert(contained(hex, parent), id + ' ' + language + ' ' + font + ' stays inside color row');
        assert(hex.clientWidth >= 95, id + ' ' + language + ' ' + font + ' has room for HEX values');
      }
    }
  }
  App.closeModal(); await pause(450); el('clear-selection').click();
  const welcome = LanguageUI.ensureChoice({ ...App.state.settings, languageChosen: false });
  await wait(() => el('first-language-zh'));
  for (const font of [1.2, 1.5]) {
    App.applyFontScale(font); await paint();
    const card = document.querySelector('.language-welcome-card');
    assert(card.scrollWidth <= card.clientWidth + 1 && contained(el('language-welcome-title'), card), 'First language welcome ' + font + ' fits');
  }
  el('first-language-zh').click(); await welcome;
  I18n.setLanguage('zh-CN'); App.applyFontScale(1.2); el('toast-root').replaceChildren();
  await pause(650);
  return { passed: checks.length, checks, viewport: { width: innerWidth, height: innerHeight }, synthetic: true };
})();
