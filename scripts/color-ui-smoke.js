/* Native Electron acceptance, using only a generated color study. */
(async()=>{
  const checks=[],el=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
  const assert=(ok,label,detail)=>{if(!ok)throw new Error(label+(detail?' '+JSON.stringify(detail):''));checks.push(label);};
  const wait=async fn=>{for(let i=0;i<700;i++){if(fn())return;await pause(20);}throw new Error('Color editor timeout: '+fn);};
  const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await wait(()=>window.App?.state.settingsReady&&App.state.photos.length&&window.PhotoEditor&&window.I18n);
  assert(App.api.isDemo,'Synthetic-only color fixture');await I18n.ready;
  const api=App.api,original={source:api.source,save:api.saveImage,language:I18n.language(),font:App.state.settings.fontScale},saved=[];
  const c=document.createElement('canvas');c.width=2000;c.height=1300;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,2000,1300);g.addColorStop(0,'#566e75');g.addColorStop(1,'#b9c9bb');x.fillStyle=g;x.fillRect(0,0,2000,1300);
  x.fillStyle='#f5eedf';x.fillRect(90,80,1820,1140);x.fillStyle='#354f48';x.font='46px Georgia';x.fillText('THE LIGHT STUDY',160,180);x.font='23px sans-serif';x.fillText('SYNTHETIC COLOR REFERENCE / 01',160,229);
  const portrait=x.createLinearGradient(160,300,1130,1110);portrait.addColorStop(0,'#a5bec3');portrait.addColorStop(1,'#728c78');x.fillStyle=portrait;x.fillRect(160,280,970,860);
  x.fillStyle='#365852';x.beginPath();x.moveTo(160,930);x.lineTo(450,650);x.lineTo(780,940);x.lineTo(1130,570);x.lineTo(1130,1140);x.lineTo(160,1140);x.fill();
  x.fillStyle='#374f46';x.beginPath();x.ellipse(670,695,175,260,0,0,Math.PI*2);x.fill();
  x.fillStyle='#c79270';x.fillRect(620,830,100,120);x.fillStyle='#e2bb9a';x.beginPath();x.ellipse(674,704,132,182,0,0,Math.PI*2);x.fill();
  const shade=x.createLinearGradient(540,610,810,780);shade.addColorStop(0,'#c38f6b');shade.addColorStop(.55,'#e0b08d');shade.addColorStop(1,'#b77f61');x.fillStyle=shade;x.beginPath();x.ellipse(674,704,132,182,0,0,Math.PI*2);x.fill();
  x.save();x.beginPath();x.ellipse(674,704,132,182,0,0,Math.PI*2);x.clip();for(let row=530;row<890;row+=4)for(let col=540;col<810;col+=4){x.fillStyle=(row+col)%12?'#ffffff08':'#3f281411';x.fillRect(col,row,1,1);}x.restore();
  x.fillStyle='#30473f';x.beginPath();x.ellipse(672,560,145,75,-.2,0,Math.PI*2);x.fill();x.beginPath();x.moveTo(480,1140);x.lineTo(530,950);x.quadraticCurveTo(670,890,810,950);x.lineTo(870,1140);x.fill();
  for(const [i,color] of ['#7d513e','#b47758','#dca88a','#f7e9d5','#577aa4','#56856d'].entries()){const yy=320+i*124;x.fillStyle=color;x.fillRect(1210,yy,540,86);x.fillStyle='#586a5c';x.font='18px monospace';x.fillText(['DEEP','WARM','LIGHT','HIGHLIGHT','COOL','GREEN'][i],1770,yy+47);}
  const source=c.toDataURL('image/png'),photo={...App.state.photos[0],name:'Synthetic Light Study.png',stem:'Synthetic Light Study',jpegPath:'/synthetic/color-study.png',rawPath:null};
  api.source=async()=>source;api.saveImage=async args=>{saved.push(args);return{canceled:true};};
  const idle=async()=>{await wait(()=>el('edit-canvas')&&!el('skin-auto').disabled&&el('edit-canvas').closest('.modal-backdrop').dataset.colorBusy==='false');await paint();};
  const change=(id,v,type='input')=>{el(id).value=String(v);el(id).dispatchEvent(new Event(type,{bubbles:true}));};
  const data=()=>el('edit-canvas').getContext('2d').getImageData(0,0,el('edit-canvas').width,el('edit-canvas').height).data;
  const same=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
  const points=()=>el('color-curve').querySelectorAll('[data-node]').length;
  const pointer=(target,type,px,py)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerId:17,clientX:px,clientY:py}));
  const graphPoint=(px,py)=>{const b=el('color-curve').getBoundingClientRect();return[b.left+(24+px*240)/288*b.width,b.top+(216-py*192)/240*b.height];};
  let leaveOpen=false;
  try{
    I18n.setLanguage('en');App.applyFontScale(1.2);await Studio.edit(photo);await idle();
    const neutral=data();assert(el('edit-canvas').width===1568&&el('edit-canvas').height===1019,'Preview bounds memory while source keeps full resolution');
    assert([...document.querySelectorAll('[data-channel]')].length===6&&points()===2,'Six channels start neutral with endpoint controls');
    assert(!el('edit-panel-color').hidden&&el('edit-panel-skin').hidden,'Curves and complementary reference share the default panel');
    const graph=el('color-curve');const p=graphPoint(.5,.67);pointer(graph,'pointerdown',...p);pointer(graph,'pointerup',...p);await idle();assert(points()===3&&!same(data(),neutral),'Click adds a visible point and changes actual pixels');
    const drag=graphPoint(.4,.57),dot=graph.querySelector('[data-node="1"]');pointer(dot,'pointerdown',...p);pointer(graph,'pointermove',...drag);pointer(graph,'pointerup',...drag);await idle();assert(Math.abs(+el('curve-input').value-102)<=1&&Math.abs(+el('curve-output').value-145)<=1,'Dragging moves both input and output coordinates');
    const beforeKey=+el('curve-output').value;graph.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));await idle();assert(+el('curve-output').value===beforeKey+1&&graph.contains(document.activeElement),'Arrow key fine-tunes the selected point and keeps focus after rendering');
    change('curve-input',125,'change');change('curve-output',168,'change');await idle();assert(+el('curve-input').value===125&&+el('curve-output').value===168,'Numeric curve coordinates are editable');
    graph.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));await idle();assert(points()===2&&same(data(),neutral),'Delete removes a curve point and restores identity pixels');
    document.querySelector('[data-channel="temperature"]').click();el('curve-add').click();change('curve-output',30,'change');await idle();assert(el('curve-output').min==='-100'&&el('curve-output').max==='100'&&!same(data(),neutral),'Temperature curve has a centered signed offset and changes pixels');
    el('edit-undo').click();await idle();assert(+el('curve-output').value===0,'Undo restores the prior neutral offset');el('edit-redo').click();await idle();assert(!same(data(),neutral),'Redo restores the temperature change');
    el('edit-reset').click();await idle();assert(same(data(),neutral),'Reset restores source pixels exactly');
    document.querySelector('[data-pair="blue"]').click();assert(document.querySelector('[data-channel="blue"]').getAttribute('aria-pressed')==='true'&&el('complement-wheel').getAttribute('aria-valuenow')==='240','Complementary pair selects the corresponding RGB channel');
    el('complement-wheel').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));assert(el('complement-wheel').getAttribute('aria-valuenow')==='250','Color reference supports keyboard hue adjustment');
    el('edit-tab-skin').click();el('skin-auto').click();await idle();assert(el('skin-strength').value==='65'&&!same(data(),neutral),'One-click skin radiance analyzes and adjusts the generated warm tones');
    el('skin-mask').click();await idle();const maskPixels=data();assert(el('edit-view-label').textContent==='Cyan shows the adjustment mask','Mask view has an explicit label');
    el('skin-pick').click();const box=el('edit-canvas').getBoundingClientRect();pointer(el('edit-canvas'),'pointerdown',box.left+box.width*.337,box.top+box.height*.54);await idle();assert(el('skin-report').textContent.includes('Sampled skin'),'Photo sampling constrains the skin color range');el('skin-clear').click();await idle();
    el('skin-mask').click();change('edit-temperature',22);change('edit-tint',-9);await idle();const edited=data();
    const expected=ColorEngine.defaults();expected.skin=65;expected.temperature=22;expected.tint=-9;const profile=ColorEngine.analyze(neutral);
    assert(same(edited,ColorEngine.render(neutral,expected,profile)),'Worker preview exactly matches the deterministic processing core');
    el('edit-compare').click();await idle();assert(same(data(),neutral),'Before view is byte-exact ungraded source');
    el('edit-save-as').click();await wait(()=>saved.length===1&&!el('edit-save-as').disabled);await idle();
    const img=new Image();img.src=saved[0].dataUrl;await img.decode();assert(img.naturalWidth===2000&&img.naturalHeight===1300,'Export uses the full source dimensions even while Before view is active');
    const out=document.createElement('canvas');out.width=2000;out.height=1300;out.getContext('2d').drawImage(img,0,0);const actual=out.getContext('2d').getImageData(0,0,2000,1300).data;
    const expectedFull=ColorEngine.render(x.getImageData(0,0,2000,1300).data,expected,profile);let error=0;for(let i=0;i<actual.length;i+=4)for(let j=0;j<3;j++)error+=Math.abs(actual[i+j]-expectedFull[i+j]);error/=2000*1300*3;
    assert(saved[0].dataUrl.startsWith('data:image/png;')&&error<.01,'Lossless full-resolution save transport uses preview analysis without mask or Before view',error);assert(!same(maskPixels,edited),'Mask overlay is separate from graded output');
    const click=HTMLAnchorElement.prototype.click;let download;
    try{HTMLAnchorElement.prototype.click=function(){download={url:this.href,name:this.download};};await original.save({...saved[0],suggestedName:'synthetic-color.jpg'});assert(download?.url.startsWith('data:image/jpeg;')&&download.name==='synthetic-color.jpg','Demo export also matches the requested JPEG file type');}finally{HTMLAnchorElement.prototype.click=click;}
    el('edit-compare').click();await idle();const graded=data();
    el('edit-tab-geometry').click();el('rotate-right').click();await idle();assert(el('edit-canvas').height>el('edit-canvas').width&&el('skin-strength').value==='65','Geometry changes retain color settings');el('edit-undo').click();await idle();assert(same(data(),graded),'Undo geometry restores the exact graded preview',{before:[...graded.slice(0,12)],after:[...data().slice(0,12)],changed:data().reduce((n,v,i)=>n+(v!==graded[i]),0),params:['skin-strength','edit-temperature','edit-tint'].map(id=>el(id).value),status:el('edit-status').textContent});
    for(const language of ['zh-CN','en'])for(const font of [1.2,1.5]){
      I18n.setLanguage(language);App.applyFontScale(font);await paint();
      for(const key of ['color','skin','geometry']){el('edit-tab-'+key).click();await paint();const panel=el('edit-panel-'+key);assert(panel.scrollWidth<=panel.clientWidth+1,language+' '+font+' '+key+' panel has no horizontal overflow');}
      assert(same(data(),graded),language+' '+font+' language and font changes preserve pixels');
    }
    const untranslated=[...document.querySelectorAll('.photo-editor button,.photo-editor label,.photo-editor h4,.photo-editor p,.photo-editor small,.photo-editor summary,.photo-editor [aria-label],#edit-status')].filter(n=>/[\u4e00-\u9fff]/.test(n.textContent+(n.getAttribute('aria-label')||''))).map(n=>n.textContent);
    assert(!untranslated.length,'All new controls and live status are translated into English',untranslated);
    const target=el('edit-preview'),b=target.getBoundingClientRect();target.dispatchEvent(new WheelEvent('wheel',{altKey:true,deltaY:-250,clientX:b.left+b.width/2,clientY:b.top+b.height/2,bubbles:true,cancelable:true}));assert(+target.dataset.zoom>1,'Alt wheel magnifies color details');el('edit-fit').click();assert(+target.dataset.zoom===1,'Fit resets magnification');
    const calls=saved.length;change('edit-temperature',30);App.closeModal();await pause(100);assert(saved.length===calls&&!el('edit-canvas'),'Discard closes worker and never calls image save');
    App.applyFontScale(1.2);I18n.setLanguage('zh-CN');await Studio.edit(photo);await idle();el('skin-auto').click();await idle();document.querySelector('[data-channel="temperature"]').click();el('curve-add').click();change('curve-output',12,'change');await idle();
    await pause(3500);leaveOpen=true;return{syntheticOnly:true,passed:checks.length,checks,exportMeanError:error,viewport:[innerWidth,innerHeight]};
  }finally{api.source=original.source;api.saveImage=original.save;if(!leaveOpen){App.closeModal();I18n.setLanguage(original.language);App.applyFontScale(original.font||1.2);}}
})();
