(async () => {
  const checks = [], assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const wait = async condition => { for (let i=0;i<240;i++) { if(condition()) return; await new Promise(resolve=>setTimeout(resolve,25)); } throw new Error('Native import timed out'); };
  await wait(()=>window.App?.state.settingsReady && !App.state.scanning);
  const api=window.timeMachine, settings=await api.getSettings(), source=settings.libraryRoot;
  const initial=await api.scan(source), first=initial.photos[0];
  assert(initial.photos.length===3 && first, 'Synthetic source has three independent photo groups');
  await api.update({ids:[first.id],patch:{favorite:true,tags:['keep-source-tag']}});
  // The synthetic profile is provisioned by package-smoke; no personal paths are used.
  const destination=settings.importDestination;
  assert(Boolean(destination), 'Isolated profile supplies a preapproved import archive');
  const progress=[],unsubscribe=api.onProgress(payload=>{if(payload.kind==='import')progress.push(payload);});
  try {
    const result=await api.importPhotos({source,destination,theme:'Fresh memories'});
    assert(result.imported.length===4 && result.errors.length===0 && !result.cancelled, 'Production IPC copies three JPEGs and one paired CR3');
    assert(result.settings.libraryRoots.includes(source) && result.settings.libraryRoots.includes(result.destination), 'Import registers the new theme while retaining the old independent directory');
    assert(result.root===result.settings.libraryRoot && result.roots.includes(result.root), 'Import returns a registered root that the gallery can refresh');
    assert(result.settings.defaultTheme==='Fresh memories', 'New theme persists as the default display');
    assert(progress.some(p=>p.phase==='preparing') && progress.some(p=>p.phase==='copying'), 'Preparation and copying both publish production progress');
    const union=await api.scan(result.root);
    assert(union.photos.length===6 && union.photos.filter(p=>p.theme==='Fresh memories').length===3, 'Global index contains both old and newly imported themes');
    const retained=union.photos.find(p=>p.id===first.id);
    assert(retained?.favorite && retained.tags.includes('keep-source-tag'), 'Original favorites and tags survive multi-directory refresh');
    const indexed=await api.importPhotos({source:result.destination,destination,theme:'Fresh memories'});
    assert(indexed.mode==='indexed' && indexed.indexedCount===3 && indexed.imported.length===0, 'Existing target theme is indexed in place without duplicating files');
    assert((await api.scan(indexed.settings.libraryRoot)).photos.length===6, 'Repeated in-place registration does not duplicate gallery photos');
    const beforeDuplicate=await api.getSettings();
    const duplicate=await api.importPhotos({source,destination,theme:'No duplicates'});
    assert(duplicate.imported.length===0 && duplicate.skipped===4 && duplicate.roots.length===2 && duplicate.settings.defaultTheme===beforeDuplicate.defaultTheme, 'All-duplicate import keeps the existing index and default theme without creating a phantom folder');
    let sourceRejected=false;try{await api.importPhotos({source:source+'/..',destination,theme:'Unapproved'});}catch{sourceRejected=true;}
    assert(sourceRejected, 'An existing but unapproved source directory is rejected');
    const removed=await api.removeLibrary(source);
    assert(removed.settings.defaultTheme==='', 'Removing a scope resets a potentially missing default theme to all themes');
    assert(removed.roots.length===1 && (await api.scan(removed.root)).photos.length===3, 'Removing one index affects only its visible photo scope');
    const restored=await api.registerLibrary(source);
    const recovered=await api.scan(restored.root);
    assert(recovered.photos.length===6 && recovered.photos.find(p=>p.id===first.id)?.favorite, 'Readding an index restores original favorites without deleting files');
    let rejected=false;try{await api.saveSettings({libraryRoots:['/unapproved-synthetic-root']});}catch{rejected=true;}
    assert(rejected, 'Unapproved paths cannot be injected into the persisted library index');
    await api.saveSettings({installUpdatesAutomatically:false,checkUpdatesAutomatically:false});
    assert((await api.getSettings()).installUpdatesAutomatically===false, 'Production automatic update preference persists as a boolean');
    rejected=false;try{await api.saveSettings({installUpdatesAutomatically:'yes'});}catch{rejected=true;}
    assert(rejected, 'Invalid automatic update preferences are rejected by production IPC');
  } finally {unsubscribe();}
  return {passed:checks.length,checks};
})();
