/* Production file protocol -> color worker -> save dialog IPC -> disk. */
(async()=>{
  const checks=[],el=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
  const assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const wait=async fn=>{for(let i=0;i<750;i++){if(fn())return;await pause(20);}throw new Error('Native color timeout');};
  await wait(()=>window.App?.state.settingsReady&&App.state.photos.some(p=>p.jpegPath)&&!App.state.scanning);
  assert(!App.api.isDemo,'Color export uses production IPC');
  const photo=App.state.photos.find(p=>p.jpegPath);assert(!!photo.rawPath,'Synthetic JPEG is paired with CR3');
  const source=await App.api.source({id:photo.id,format:'jpeg'}),image=new Image();image.crossOrigin='anonymous';image.src=typeof source==='string'?source:source.url;await image.decode();
  const raw=document.createElement('canvas');raw.width=image.naturalWidth;raw.height=image.naturalHeight;const ctx=raw.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  await Studio.edit(photo);await wait(()=>el('edit-canvas')&&!el('skin-auto').disabled&&el('edit-canvas').closest('.modal-backdrop').dataset.colorBusy==='false');
  const display=el('edit-canvas'),profile=ColorEngine.analyze(display.getContext('2d').getImageData(0,0,display.width,display.height).data);
  el('skin-auto').click();for(const [id,value] of [['edit-temperature',18],['edit-tint',-7]]){el(id).value=value;el(id).dispatchEvent(new Event('input',{bubbles:true}));}
  await wait(()=>el('edit-canvas').closest('.modal-backdrop').dataset.colorBusy==='false');
  assert(el('skin-strength').value==='65','One-click radiance applies to real decoded fixture');
  const settings=ColorEngine.defaults();settings.skin=65;settings.temperature=18;settings.tint=-7;
  const full=ColorEngine.render(ctx.getImageData(0,0,raw.width,raw.height).data,settings,profile);
  const samples=[[200,200],[1100,700],[2050,1300]].map(([x,y])=>({x,y,rgb:[...full.slice((y*raw.width+x)*4,(y*raw.width+x)*4+3)]}));
  el('skin-mask').click();await wait(()=>el('edit-canvas').closest('.modal-backdrop').dataset.colorBusy==='false');
  el('edit-save-as').click();await wait(()=>!el('edit-canvas'));assert(!el('edit-canvas'),'Native save completes and closes the editor');
  return{syntheticOnly:true,passed:checks.length,checks,width:raw.width,height:raw.height,samples};
})();
