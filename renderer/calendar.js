'use strict';
(() => {
  let popup = null, activeInput = null, year = 0, month = 0;
  const t = value => window.I18n?.t(value) ?? value;
  const language = () => window.I18n?.language() === 'en' ? 'en' : 'zh-CN';
  const pad = value => String(value).padStart(2, '0');
  const iso = date => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  const monthName = index => language() === 'en' ? new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, index, 1)) : `${index + 1} 月`;
  const weekdayName = index => language() === 'en' ? new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(2024, 0, 1 + index)) : ['一','二','三','四','五','六','日'][index];
  function parse(value) {
    const match = String(value || '').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return null;
    const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
    if (y < 1900 || y > 2200) return null;
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
  }
  function close(focus = false) {
    if (!popup) return;
    const input = activeInput;
    popup.remove(); popup = null; activeInput = null;
    document.querySelectorAll('.date-picker-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (focus) input?.focus({ preventScroll: true });
  }
  function normalize(input) {
    const value = input.value.trim();
    if (!value) { input.dataset.lastDate = ''; input.removeAttribute('aria-invalid'); return true; }
    const date = parse(value);
    if (date) { input.value = iso(date); input.dataset.lastDate = input.value; input.removeAttribute('aria-invalid'); return true; }
    input.value = input.dataset.lastDate || ''; input.setAttribute('aria-invalid', 'true');
    window.App?.toast(t('请使用 YYYY-MM-DD 或 YYYY/MM/DD 输入有效日期')); return false;
  }
  function choose(value) {
    const input = activeInput; if (!input) return;
    input.value = value; input.dataset.lastDate = value; input.removeAttribute('aria-invalid');
    input.dispatchEvent(new Event('change', { bubbles: true })); close(true);
  }
  function position() {
    if (!popup || !activeInput) return;
    const rect = activeInput.getBoundingClientRect(), height = popup.getBoundingClientRect().height, width = popup.getBoundingClientRect().width;
    popup.style.left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px';
    popup.style.top = Math.max(12, rect.bottom + 8 + height <= innerHeight - 12 ? rect.bottom + 8 : rect.top - height - 8) + 'px';
  }
  function localize() {
    document.querySelectorAll('.date-picker-button').forEach(button => button.setAttribute('aria-label', t(button.dataset.datePicker === 'date-from' ? '打开开始日期日历' : '打开结束日期日历')));
    if (!popup) return;
    // Change labels in place: preserve the entered year, month, focus and popup.
    const start = activeInput.id === 'date-from';
    popup.setAttribute('aria-label', t(start ? '开始日期日历' : '结束日期日历'));
    popup.querySelector('.date-calendar-title > span').textContent = t(start ? '选择开始日期' : '选择结束日期');
    popup.querySelector('.date-calendar-close').setAttribute('aria-label', t('关闭日历'));
    popup.querySelector('[data-month-step="-1"]').setAttribute('aria-label', t('上个月'));
    popup.querySelector('[data-month-step="1"]').setAttribute('aria-label', t('下个月'));
    popup.querySelector('.calendar-year').setAttribute('aria-label', t('年份'));
    const months = popup.querySelector('.calendar-month'); months.setAttribute('aria-label', t('月份'));
    [...months.options].forEach((option, index) => { option.textContent = monthName(index); });
    popup.querySelectorAll('.calendar-weekdays span').forEach((node, index) => { node.textContent = weekdayName(index); });
    popup.querySelector('.calendar-days').setAttribute('aria-label', t('选择日期'));
    popup.querySelector('[data-calendar-clear]').textContent = t('清除日期');
    popup.querySelector('[data-calendar-today]').textContent = t('今天');
    popup.querySelector('.calendar-format-hint').textContent = t('也可以直接输入 YYYY-MM-DD 或 YYYY/MM/DD。');
    window.GlassDropdown?.refresh(); position();
  }
  function render() {
    if (!popup) return;
    const selected = parse(activeInput.value), today = iso(new Date()), first = new Date(year, month, 1), start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
    popup.innerHTML = `<div class="date-calendar-title"><span></span><button class="date-calendar-close" type="button">×</button></div><div class="calendar-controls"><button class="calendar-arrow" data-month-step="-1" type="button">‹</button><input class="calendar-year" type="number" min="1900" max="2200" value="${year}"><select class="calendar-month">${Array.from({length:12},(_,i)=>`<option value="${i}" ${i===month?'selected':''}></option>`).join('')}</select><button class="calendar-arrow" data-month-step="1" type="button">›</button></div><div class="calendar-weekdays" aria-hidden="true">${Array.from({length:7},()=>'<span></span>').join('')}</div><div class="calendar-days" role="group">${Array.from({length:42},(_,i)=>{const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),value=iso(date);return `<button type="button" class="calendar-day ${date.getMonth()===month?'':'outside-month'} ${value===today?'today':''} ${selected&&value===iso(selected)?'selected':''}" data-date="${value}" aria-label="${value}" ${selected&&value===iso(selected)?'aria-pressed="true"':''}>${date.getDate()}</button>`;}).join('')}</div><div class="calendar-footer"><button type="button" data-calendar-clear></button><button type="button" data-calendar-today></button></div><p class="calendar-format-hint"></p>`;
    popup.querySelector('.date-calendar-close').onclick = () => close(true);
    popup.querySelectorAll('[data-date]').forEach(button => button.onclick = () => choose(button.dataset.date));
    popup.querySelector('[data-calendar-clear]').onclick = () => choose(''); popup.querySelector('[data-calendar-today]').onclick = () => choose(today);
    popup.querySelectorAll('[data-month-step]').forEach(button => button.onclick = () => { const date = new Date(year, month + Number(button.dataset.monthStep), 1); year = Math.max(1900, Math.min(2200, date.getFullYear())); month = date.getMonth(); render(); });
    popup.querySelector('.calendar-month').onchange = event => { month = Number(event.target.value); render(); popup?.querySelector('.calendar-month + .glass-select-trigger')?.focus({ preventScroll: true }); };
    popup.querySelector('.calendar-year').onchange = event => { year = Math.max(1900, Math.min(2200, Math.round(Number(event.target.value)) || year)); render(); };
    localize();
  }
  function open(input, focus = true) {
    if (activeInput === input && popup) return; close(); activeInput = input;
    const current = parse(input.value) || new Date(); year = current.getFullYear(); month = current.getMonth();
    popup = document.createElement('section'); popup.className = 'date-calendar'; popup.id = 'date-calendar'; popup.dataset.i18nIgnore = 'true'; popup.setAttribute('role', 'dialog'); document.body.append(popup);
    document.querySelector(`[data-date-picker="${input.id}"]`)?.setAttribute('aria-expanded', 'true'); render();
    if (focus) (popup.querySelector('.calendar-day.selected') || popup.querySelector('.calendar-year')).focus({ preventScroll: true });
  }
  function init() {
    for (const id of ['date-from', 'date-to']) {
      const input = document.getElementById(id); if (!input) continue;
      input.type = 'text'; input.inputMode = 'numeric'; input.placeholder = 'YYYY-MM-DD'; input.autocomplete = 'off'; input.dataset.lastDate = input.value; input.setAttribute('aria-haspopup', 'dialog');
      input.addEventListener('change', () => normalize(input), true);
      input.addEventListener('blur', () => { if (input.value !== input.dataset.lastDate) { normalize(input); input.dispatchEvent(new Event('change', { bubbles: true })); } });
      input.addEventListener('click', () => open(input, false));
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { normalize(input); input.dispatchEvent(new Event('change', { bubbles: true })); close(); } if (event.key === 'ArrowDown' && (event.altKey || !input.value)) { event.preventDefault(); open(input); } });
      const button = document.createElement('button'); button.className = 'date-picker-button'; button.type = 'button'; button.dataset.datePicker = id; button.dataset.i18nIgnore = 'true'; button.setAttribute('aria-controls', 'date-calendar'); button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 10h18M7 14h3M14 14h3M7 17h3"/></svg>'; button.onclick = () => activeInput === input ? close(true) : open(input); input.after(button);
    }
    document.getElementById('reset-filters')?.addEventListener('click', () => { for (const id of ['date-from', 'date-to']) { const input = document.getElementById(id); if (input) { input.dataset.lastDate = ''; input.removeAttribute('aria-invalid'); } } close(); });
    document.addEventListener('pointerdown', event => { if (popup && !popup.contains(event.target) && event.target !== activeInput && !event.target.closest('.date-picker-button') && event.target.closest('.glass-dropdown')?.dataset.ownerCalendar !== 'true') close(); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && popup) { event.preventDefault(); event.stopImmediatePropagation(); close(true); } }, true);
    window.addEventListener('resize', position); document.getElementById('main-scroll')?.addEventListener('scroll', () => close(), { passive: true });
    window.I18n?.onChange(localize); window.DateCalendar = { open, close, parse }; localize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
