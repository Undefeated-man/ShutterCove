'use strict';
(() => {
  const title = document.querySelector('.brand-title');
  if (!title || !window.I18n) return;

  // Localization owns the complete title. The two unbreakable Chinese words
  // keep that same textContent, so ordinary translation and accessible text
  // remain intact while the browser selects a line break from the real width.
  function refresh() {
    if (window.I18n.language() !== 'zh-CN' || title.textContent !== '时光杂货店') return;
    const words = [...title.children];
    if (words.length === 2 && words[0].classList.contains('brand-word') &&
      words[0].textContent === '时光' && words[1].classList.contains('brand-word') &&
      words[1].textContent === '杂货店') return;
    const first = document.createElement('i'), second = document.createElement('i');
    first.className = second.className = 'brand-word';
    first.textContent = '时光'; second.textContent = '杂货店';
    title.replaceChildren(first, second);
  }

  window.I18n.onChange(refresh);
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; refresh(); });
  }).observe(title, { childList: true, characterData: true, subtree: true });
  window.I18n.ready.then(refresh);
  refresh();
})();
