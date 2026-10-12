/* Public screenshot uses only built-in synthetic landscapes. */
(async () => {
  const wait = async test => { for (let i = 0; i < 600; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('Synthetic motion screenshot timeout'); };
  await wait(() => window.App?.api.isDemo && App.state.photos.length && !App.state.scanning);
  await MotionStudio.open(App.state.photos.slice(0, 7));
  const el = id => document.getElementById(id);
  el('motion-film-track').querySelector('[data-index="3"]').click();
  el('motion-add-speech').click(); el('motion-text').value = '把光留住，\n把日子过成电影。'; el('motion-text').dispatchEvent(new Event('input', { bubbles: true }));
  el('motion-scale').value = '75'; el('motion-scale').dispatchEvent(new Event('input', { bubbles: true }));
  el('motion-colors').value = '128'; el('motion-colors').dispatchEvent(new Event('change', { bubbles: true }));
  el('motion-preview').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  await new Promise(resolve => setTimeout(resolve, 600));
  return { syntheticOnly: true, motionStudio: true, frames: 7 };
})();
