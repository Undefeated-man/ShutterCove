/* Run with --smoke --onboarding and the same isolated --qa-user-data profile
 * three times. package-smoke prepends the phase ('skip', 'finish', 'restart') to
 * each invocation; no source directory is selected or scanned by this test. */
(async () => {
  const checks = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const el = id => document.getElementById(id);
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = async condition => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Onboarding UI timeout: ${condition.toString()}; step=${el('onboarding-step')?.textContent}; error=${el('onboarding-error')?.textContent}`);
  };
  const key = (node, value, extra = {}) => node.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, ...extra }));
  const phase = window.__qaOnboardingPhase || 'skip';
  await wait(() => window.App?.api && window.Onboarding?.isOpen && typeof App.state.settings.onboardingCompleted === 'boolean');
  const api = App.api, originalChoose = App.chooseLibrary;
  const initial = await api.getSettings();
  const otherSettings = settings => JSON.stringify(Object.fromEntries(Object.entries(settings).filter(([name]) => name !== 'onboardingCompleted')));
  const originalSettings = otherSettings(initial);
  const originalScale = getComputedStyle(document.documentElement).getPropertyValue('--font-scale');
  const step = () => Number(el('onboarding-step')?.textContent.match(/\d+/)?.[0]);
  const open = () => Onboarding.isOpen() && !!el('onboarding-dialog');
  const visible = node => !!node && !node.hidden && getComputedStyle(node).display !== 'none' && node.getClientRects().length > 0;
  const focusInside = () => el('onboarding-dialog')?.contains(document.activeElement);
  const layout = async label => {
    await frames();
    const dialog = el('onboarding-dialog'), rect = dialog.getBoundingClientRect();
    const controls = ['onboarding-prev', 'onboarding-next', 'onboarding-skip', 'onboarding-finish', 'onboarding-open-folder'].map(el).filter(node => visible(node) && !node.disabled);
    assert(rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1, `${label}: dialog fits the window`);
    assert(dialog.scrollWidth <= dialog.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, `${label}: no horizontal overflow`);
    assert(controls.every(node => { const r = node.getBoundingClientRect(); return r.left >= rect.left && r.right <= rect.right + 1 && r.top >= rect.top && r.bottom <= innerHeight + 1; }), `${label}: navigation buttons remain visible`);
  };
  const keyboardBoundary = async () => {
    const dialog = el('onboarding-dialog');
    const buttons = [...dialog.querySelectorAll('button,input,a[href],[tabindex="0"]')].filter(node => !node.disabled && visible(node) && node.tabIndex >= 0);
    const first = buttons[0], last = buttons.at(-1);
    assert(!!first && !!last, 'The guide has focusable keyboard controls');
    last.focus({ preventScroll: true });
    key(last, 'Tab');
    await frames();
    assert(document.activeElement === first, 'Tab at the final guide control wraps inside the dialog');
    first.focus({ preventScroll: true });
    key(first, 'Tab', { shiftKey: true });
    await frames();
    assert(document.activeElement === last, 'Shift-Tab at the first guide control wraps inside the dialog');
  };
  const walkthrough = async () => {
    await wait(() => open() && step() === 1);
    assert(!visible(el('onboarding-prev')) || el('onboarding-prev').disabled, 'The first step cannot navigate before the guide');
    assert(focusInside(), 'Opening the guide places keyboard focus inside its dialog');
    await layout('Default or saved font size, first step');
    App.applyFontScale(1.5);
    await layout('150 percent font size, first step');
    el('onboarding-next').focus({ preventScroll: true });
    key(el('onboarding-next'), 'ArrowRight');
    await wait(() => step() === 2);
    assert(focusInside(), 'Keyboard next-step navigation keeps focus inside the guide');
    await layout('150 percent font size, step 2');
    el('onboarding-next').click();
    await wait(() => step() === 3);
    el('onboarding-prev').click();
    await wait(() => step() === 2);
    assert(focusInside(), 'Previous-step navigation restores an interactive guide focus');
    el('onboarding-next').click();
    await wait(() => step() === 3);
    await layout('150 percent font size, step 3');
    el('onboarding-next').click();
    await wait(() => step() === 4);
    key(document.activeElement, 'ArrowLeft');
    await wait(() => step() === 3);
    key(document.activeElement, 'ArrowRight');
    await wait(() => step() === 4);
    await layout('150 percent font size, step 4');
    el('onboarding-next').click();
    await wait(() => step() === 5);
    assert(!visible(el('onboarding-next')) && visible(el('onboarding-finish')) && visible(el('onboarding-open-folder')), 'The final step offers completion and opening a folder');
    assert(focusInside(), 'The final step keeps focus on its visible controls');
    await layout('150 percent font size, final step');
    await keyboardBoundary();
  };
  const replay = async () => {
    el('settings-button').click();
    await wait(() => el('show-onboarding'));
    el('show-onboarding').click();
    await wait(() => open() && step() === 1);
    assert(open() && !el('setting-font-scale'), 'Settings closes its modal and reopens the guide from the first step');
  };
  try {
    assert(!api.isDemo && initial.libraryRoot === '' && App.state.photos.length === 0 && !App.state.scanning, 'The production guide test uses an isolated empty library');
    assert(new URLSearchParams(location.search).get('skipOnboarding') !== '1', 'Dedicated onboarding smoke exercises the real automatic startup path');
    if (phase === 'skip') {
      assert(initial.onboardingCompleted === false && open(), 'A newly installed profile automatically opens the first-use guide');
      for (const value of ['true', 1, null, []]) {
        let rejected = false;
        try { await api.saveSettings({ onboardingCompleted: value }); } catch { rejected = true; }
        const current = await api.getSettings();
        assert(rejected && current.onboardingCompleted === false && otherSettings(current) === originalSettings, `Production settings rejects invalid completion value ${JSON.stringify(value)} without changing other settings`);
      }
      await walkthrough();
      let failed = false;
      App.api = { ...api, saveSettings: async patch => {
        if (patch.onboardingCompleted === true && !failed) { failed = true; throw new Error('模拟设置写入失败，请重试'); }
        return api.saveSettings(patch);
      } };
      el('onboarding-skip').click();
      await wait(() => failed && visible(el('onboarding-error')) && !el('onboarding-skip').disabled);
      assert(open() && el('onboarding-error').textContent.includes('模拟设置写入失败') && (await api.getSettings()).onboardingCompleted === false, 'A failed completion save keeps the guide open and offers retry');
      el('onboarding-skip').click();
      await wait(() => !open());
      assert((await api.getSettings()).onboardingCompleted === true && App.state.settings.onboardingCompleted === true, 'Retrying Skip persists completion through production IPC before closing the guide');
    } else if (phase === 'finish') {
      await frames();
      assert(initial.onboardingCompleted === true && !open(), 'A real application restart after Skip does not automatically reopen the guide');
      await replay();
      await walkthrough();
      App.state.settings = await api.saveSettings({ onboardingCompleted: false });
      const spacer = document.createElement('div');
      spacer.id = 'qa-onboarding-scroll-fixture';
      spacer.style.height = '4000px';
      spacer.setAttribute('aria-hidden', 'true');
      el('main-scroll').append(spacer);
      App.state.selected.add('qa-synthetic-selection');
      el('main-scroll').scrollTo({ top: 700, behavior: 'instant' });
      await frames();
      const library = { root: App.state.root, photos: App.state.photos, selected: [...App.state.selected], view: App.state.view, scrollTop: el('main-scroll').scrollTop };
      assert(library.scrollTop > 0 && library.selected.length === 1, 'Synthetic cancellation fixture includes a selected item and a scrolled gallery');
      let chooserCalls = 0;
      App.chooseLibrary = async () => { chooserCalls++; return null; };
      el('onboarding-open-folder').click();
      await wait(() => !open() && chooserCalls === 1);
      assert((await api.getSettings()).onboardingCompleted === true, 'The final Open Folder action saves completion before invoking the folder chooser');
      await frames();
      assert(App.state.root === library.root && App.state.photos === library.photos && JSON.stringify([...App.state.selected]) === JSON.stringify(library.selected) && App.state.view === library.view && el('main-scroll').scrollTop === library.scrollTop, 'Cancelling the final folder chooser preserves the current library, selection and scroll position');
      spacer.remove();
      App.state.selected.delete('qa-synthetic-selection');
      el('main-scroll').scrollTo({ top: 0, behavior: 'instant' });
      await frames();
      App.chooseLibrary = originalChoose;
      await replay();
      await walkthrough();
      App.state.settings = await api.saveSettings({ onboardingCompleted: false });
      App.chooseLibrary = async () => { throw new Error('Finish must not open the folder chooser'); };
      el('onboarding-finish').click();
      await wait(() => !open());
      assert((await api.getSettings()).onboardingCompleted === true && App.state.settings.onboardingCompleted === true, 'Finish persists completion without invoking the folder chooser');
    } else if (phase === 'restart') {
      await frames();
      assert(initial.onboardingCompleted === true && !open(), 'A real application restart after Finish leaves the guide closed');
      assert(!el('onboarding-dialog') && el('settings-button').getClientRects().length > 0, 'Normal library controls remain available after completion');
    } else throw new Error(`Unknown isolated onboarding test phase: ${phase}`);
    assert(otherSettings(await api.getSettings()) === originalSettings, 'Guide completion preserves every unrelated application setting');
    assert(App.state.root === '' && App.state.photos.length === 0 && !App.state.scanning, 'The guide test never selects or reads a photo folder');
  } catch (error) {
    throw new Error(`Onboarding regression failed in ${phase} after ${checks.at(-1)}: ${error.message}; ${error.stack}`);
  } finally {
    el('qa-onboarding-scroll-fixture')?.remove();
    App.state.selected.delete('qa-synthetic-selection');
    App.api = api;
    App.chooseLibrary = originalChoose;
    App.applyFontScale(originalScale);
  }
  return { passed: checks.length, checks, phase, onboardingCompleted: (await api.getSettings()).onboardingCompleted, viewport: { width: innerWidth, height: innerHeight } };
})();
