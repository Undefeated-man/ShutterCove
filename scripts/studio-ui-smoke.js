/* Synthetic-only native renderer checks for collage preview and real exports. */
(async () => {
  const checks = [], el = id => document.getElementById(id);
  const assert = (condition, label, details) => { if (!condition) throw new Error(label + (details ? ' ' + JSON.stringify(details) : '')); checks.push(label); };
  const wait = async test => { for (let attempt = 0; attempt < 500; attempt++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('Studio timeout: ' + test.toString()); };
  const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await wait(() => window.App?.api.isDemo && App.state.photos.length && !App.state.scanning);
  assert(App.api.isDemo, 'Studio fixtures use synthetic demo mode only');
  const api = App.api, saved = [], colors = [[206,68,65],[61,144,87],[64,101,195],[220,172,46],[150,83,175],[51,160,169],[217,106,51]];
  const originals = { source: api.source, thumbnail: api.thumbnail, saveImage: api.saveImage, scale: getComputedStyle(document.documentElement).getPropertyValue('--font-scale') };
  const photos = colors.map((color,index) => ({ ...App.state.photos[index], id: 'studio-fixture-'+index, name: 'Synthetic-'+index+'.JPG', stem: 'Synthetic-'+index, jpegPath: '/合成拼图/'+index+'.JPG', rawPath: null, width: 180, height: 180 }));
  const uris = new Map(photos.map((photo,index) => [photo.id, 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="rgb('+colors[index].join(',')+')"/></svg>')]));
  let sourceCalls = 0, thumbnailCalls = 0;
  api.source = async ({id}) => { if (!uris.has(id)) throw new Error('A non-synthetic source was requested'); sourceCalls++; return uris.get(id); };
  api.thumbnail = async ({id}) => { if (!uris.has(id)) throw new Error('A non-synthetic thumbnail was requested'); thumbnailCalls++; return uris.get(id); };
  api.saveImage = async args => { saved.push(args); return { canceled: true }; };
  const change = (id,value,type='change') => { el(id).value=String(value); el(id).dispatchEvent(new Event(type,{bubbles:true})); };
  const order = () => [...document.querySelectorAll('.collage-thumb img')].map(img=>img.alt);
  const eventAt = (target,name,x,y,extra={}) => { const e=new PointerEvent(name,{pointerId:31,button:0,clientX:x,clientY:y,bubbles:true,cancelable:true,...extra}); target.dispatchEvent(e); return e; };
  const decode = url => new Promise((resolve,reject) => { const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=url; });
  const captureExport = async () => { const before=saved.length; el('collage-export').click(); await wait(()=>saved.length===before+1&&!el('collage-export').disabled); return saved.at(-1); };
  // These expected cells follow the visible promise: N columns, repeated rows,
  // fixed spacing, and a title below every selected photo.
  const cells = (mode,columns,width=800,gap=24) => {
    const margin=mode==='poster'?width*.055:gap,cell=(width-2*margin-gap*(columns-1))/columns,rowHeight=cell*(mode==='poster'?1.14:1.15);
    const rows=Math.ceil(photos.length/columns);
    return {rects:photos.map((_,i)=>({x:margin+i%columns*(cell+gap),y:margin+Math.floor(i/columns)*(rowHeight+gap),w:cell,h:rowHeight})),height:Math.round(mode==='poster'?2*margin+rows*rowHeight+(rows-1)*gap+width*.13:rows*(rowHeight+gap)+gap+width*.11),gap};
  };
  const verifyPixels = async (result,mode,columns,names=photos.map(p=>p.name)) => {
    const img=await decode(result.dataUrl),expected=cells(mode,columns),c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    assert(img.width===800&&img.height===expected.height, mode+' '+columns+': JPEG export has the requested width and actual row height', [img.width,img.height,expected.height]);
    expected.rects.forEach((r,index)=>{const pixel=ctx.getImageData(Math.round(r.x+r.w/2),Math.round(r.y+r.h/2),1,1).data,color=colors[photos.findIndex(photo=>photo.name===names[index])];assert(color.every((value,channel)=>Math.abs(value-pixel[channel])<16),mode+' '+columns+': exported slot '+index+' contains its selected photo', [...pixel]);});
    const first=expected.rects[0],next=expected.rects[columns]||expected.rects[1];
    if(next){const x=Math.round(first.x+first.w/2),y=Math.round(first.y+first.h+expected.gap/2),pixel=ctx.getImageData(x,y,1,1).data;assert(Math.abs(pixel[0]-250)<16&&Math.abs(pixel[1]-247)<16,mode+' '+columns+': row spacing remains background rather than clipped photos');}
    c.width=c.height=1;return [img.width,img.height];
  };
  try {
    // Exercise the visible custom control, rather than assigning its hidden
    // select. The portalled menu sits outside aria-modal and must still be
    // painted and clickable with a real two-photo collage open.
    await Studio.collage(photos.slice(0,2));await paint();
    for(const scale of [1.2,1.5]){
      App.applyFontScale(scale);await paint();
      for(const mode of ['poster','film']){
        const select=el('collage-template');
        await wait(()=>select.parentElement.querySelector('.glass-select-trigger'));
        const trigger=select.parentElement.querySelector('.glass-select-trigger');
        trigger.scrollIntoView({block:'nearest',behavior:'instant'});await paint();trigger.focus({preventScroll:true});
        trigger.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));trigger.click();
        await wait(()=>el('glass-dropdown')&&trigger.getAttribute('aria-expanded')==='true');await paint();
        const popup=el('glass-dropdown'),r=popup.getBoundingClientRect(),label=Math.round(scale*100)+' percent two-photo '+mode;
        assert(r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,label+': clicking the visible template trigger paints a menu inside the window',r.toJSON());
        const index=[...select.options].findIndex(option=>option.value===mode),option=popup.querySelector('[data-position="'+index+'"]');
        option.scrollIntoView({block:'nearest',behavior:'instant'});await paint();const o=option.getBoundingClientRect(),hit=document.elementFromPoint(o.left+o.width/2,o.top+o.height/2);
        assert(hit===option||option.contains(hit),label+': the actual poster option is clickable above the modal backdrop');
        option.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));option.click();
        await wait(()=>select.value===mode&&!el('glass-dropdown'));await paint();
        assert(!el('collage-columns-field').hidden&&el('collage-columns').value==='2',label+': selecting the actual menu option reveals the two-column setting');
        assert(document.activeElement===trigger&&document.querySelector('.collage-studio'),label+': menu choice returns focus without closing the workbench');
      }
    }
    change('collage-columns',3);
    const menuTrigger=el('collage-template').parentElement.querySelector('.glass-select-trigger');menuTrigger.click();await wait(()=>el('glass-dropdown'));
    el('glass-dropdown').querySelector('[data-position="4"]').click();
    assert(el('collage-template').value==='poster'&&el('collage-columns').value==='3','Choosing another poster from the visible menu retains the user’s column count');
    App.closeModal();App.applyFontScale(originals.scale);
    await Studio.collage(photos);await paint();
    assert(document.querySelector('.collage-studio'), 'Dedicated collage layout is mounted');
    assert(el('collage-columns-field').hidden&&el('collage-columns').value==='2', 'Poster column setting defaults to two and is hidden for grids');
    change('collage-width',800);
    for(const mode of ['poster','film']){
      change('collage-template',mode);change('collage-background','#faf7ee','input');
      assert(!el('collage-columns-field').hidden,mode+': row count control is visible');
      for(const columns of [1,2,3]){change('collage-columns',columns);await paint();assert(el('collage-columns').value===String(columns),mode+' '+columns+': numeric control is applied');await verifyPixels(await captureExport(),mode,columns);}
    }
    assert(el('collage-columns').value==='3','Switching poster templates preserves the chosen column count');
    change('collage-columns',0);assert(el('collage-columns').value==='1','Columns below one are clamped');
    change('collage-columns',99);assert(el('collage-columns').value==='12','Columns above twelve are clamped');
    change('collage-gap',200,'input');
    assert(el('collage-canvas').width>0&&el('collage-canvas').height>0,'High column count and wide spacing still produce a positive canvas');
    change('collage-columns',2.6);assert(el('collage-columns').value==='3','Fractional columns become an integer');
    change('collage-columns','');assert(el('collage-columns').value==='2','Empty columns restore a safe default');
    change('collage-gap',24,'input');change('collage-template','poster');change('collage-columns',3);change('collage-background','#faf7ee','input');
    const frame=el('collage-preview'),display=el('collage-canvas'),modal=document.querySelector('.collage-studio'),body=modal.querySelector('.modal-body');
    const wheel = (delta,alt=true,x,y) => {const box=frame.getBoundingClientRect();const e=new WheelEvent('wheel',{deltaY:delta,altKey:alt,clientX:x??box.left+box.width/2,clientY:y??box.top+box.height/2,bubbles:true,cancelable:true});frame.dispatchEvent(e);return e;};
    const fits = () => {const f=frame.getBoundingClientRect(),c=display.getBoundingClientRect();return c.left>=f.left-1&&c.top>=f.top-1&&c.right<=f.right+1&&c.bottom<=f.bottom+1;};
    const covering = () => {const f=frame.getBoundingClientRect(),c=display.getBoundingClientRect();return c.left<=f.left+1&&c.top<=f.top+1&&c.right>=f.right-1&&c.bottom>=f.bottom-1;};
    for(const scale of [1.2,1.5]){
      App.applyFontScale(scale);await paint();el('collage-fit').click();
      const label=Math.round(scale*100)+' percent';
      assert(+frame.dataset.zoom===1&&fits(),label+': the whole collage initially fits its frame');
      assert(!wheel(-80,false).defaultPrevented,label+': ordinary wheel remains available for dialog scrolling');
      const scrollBefore=body.scrollTop;body.scrollTop=scrollBefore+90;await paint();assert(body.scrollTop>scrollBefore,label+': the detail body still scrolls');body.scrollTop=0;await paint();
      const alt=new KeyboardEvent('keydown',{key:'Alt',bubbles:true,cancelable:true});frame.dispatchEvent(alt);assert(alt.defaultPrevented,label+': preview Alt does not activate the application menu');
      const previousSources=sourceCalls,previousThumbnails=thumbnailCalls;
      assert(wheel(-Math.log(2)/.0025).defaultPrevented&&+frame.dataset.zoom>1.9,label+': Alt wheel zooms and suppresses page scrolling');
      let before=display.getBoundingClientRect(),f=frame.getBoundingClientRect();const anchor={x:f.left+f.width*.54,y:f.top+f.height*.53},u=(anchor.x-before.left)/before.width,v=(anchor.y-before.top)/before.height;
      wheel(-80,true,anchor.x,anchor.y);const after=display.getBoundingClientRect();
      assert(Math.abs(after.left+u*after.width-anchor.x)<1.5&&Math.abs(after.top+v*after.height-anchor.y)<1.5,label+': off-center photo coordinates remain under the cursor');
      assert(sourceCalls===previousSources&&thumbnailCalls===previousThumbnails,label+': zooming does not read or duplicate photo files');
      const names=order(),box=frame.getBoundingClientRect();eventAt(display,'pointerdown',box.left+box.width/2,box.top+box.height/2);eventAt(display,'pointermove',box.left+80,box.top+50);assert(display.style.cursor==='grabbing',label+': active panning has a grabbing cursor');eventAt(display,'pointerup',box.left+80,box.top+50);
      assert(JSON.stringify(order())===JSON.stringify(names),label+': zoomed dragging pans without changing photo order');
      for(let i=0;i<12;i++)wheel(-400);assert(+frame.dataset.zoom===16,label+': zoom is bounded at sixteen times fit');
      for(const direction of [-1,1]){eventAt(display,'pointerdown',box.left+100,box.top+100);eventAt(display,'pointermove',box.left+direction*100000,box.top+direction*100000);eventAt(display,'pointerup',box.left+100,box.top+100);assert(covering(),label+': panning to corner '+direction+' exposes no empty canvas edges');}
      frame.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));assert(+frame.dataset.zoom===1&&fits(),label+': double click restores the whole canvas');
      frame.dispatchEvent(new KeyboardEvent('keydown',{key:'+',bubbles:true,cancelable:true}));assert(+frame.dataset.zoom>1,label+': keyboard plus zooms');frame.dispatchEvent(new KeyboardEvent('keydown',{key:'0',bubbles:true,cancelable:true}));assert(+frame.dataset.zoom===1,label+': keyboard zero resets fit');
      wheel(-280);frame.style.width='72%';await wait(()=>+frame.dataset.zoom===1);assert(fits(),label+': resizing resets fit without clipping');frame.style.width='';await paint();
      assert(modal.scrollWidth<=modal.clientWidth+1&&body.scrollWidth<=body.clientWidth+1,label+': large fonts do not cause horizontal overflow');
      el('collage-columns').scrollIntoView({block:'nearest',behavior:'instant'});await paint();assert(el('collage-columns').getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom+1,label+': the columns setting remains reachable');
      const footer=el('collage-export').getBoundingClientRect();assert(footer.bottom<=innerHeight+1&&footer.top>=0,label+': the export action stays visible');body.scrollTop=0;await paint();
    }
    App.applyFontScale(1.2);await paint();el('collage-fit').click();
    const baseline=await captureExport();wheel(-350);const zoomed=await captureExport();assert(baseline.dataUrl===zoomed.dataUrl,'Canvas preview zoom does not change exported JPEG dimensions or pixels');
    const thumbs=[...document.querySelectorAll('.collage-thumb')],transfer=new DataTransfer(),oldNames=order();
    wheel(-300);thumbs[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));thumbs.at(-1).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    assert(JSON.stringify(order())===JSON.stringify([...oldNames.slice(1),oldNames[0]]),'Thumbnail drag reorders all seven photos even while the canvas is zoomed');
    await verifyPixels(await captureExport(),'poster',3,order());
    el('collage-fit').click();const oldOrder=order(),geometry=cells('poster',3,1000,30),box=display.getBoundingClientRect();
    const point=r=>({x:box.left+(r.x+r.w/2)/display.width*box.width,y:box.top+(r.y+r.h/2)/display.height*box.height});
    const a=point(geometry.rects[0]),b=point(geometry.rects.at(-1));eventAt(display,'pointerdown',a.x,a.y);eventAt(display,'pointerup',b.x,b.y);
    const expected=[...oldOrder];[expected[0],expected[expected.length-1]]=[expected.at(-1),expected[0]];
    assert(JSON.stringify(order())===JSON.stringify(expected),'Fit-view canvas dragging swaps the intended first and last photo');
    await verifyPixels(await captureExport(),'poster',3,order());
    wheel(-300);const oldTransform=display.style.transform,oldZoom=frame.dataset.zoom;App.closeModal();const closedWheel=wheel(-300);
    assert(!closedWheel.defaultPrevented&&frame.dataset.zoom===oldZoom&&display.style.transform===oldTransform,'Closing removes the old preview wheel listener');
    assert(display.onpointerdown===null&&display.onpointerup===null,'Closing clears detached canvas reorder handlers');
    await Studio.collage(photos);await paint();assert(+el('collage-preview').dataset.zoom===1,'Reopening starts with a fresh fit view');App.closeModal();
    return {syntheticOnly:true,passed:checks.length,viewport:[innerWidth,innerHeight],checks};
  } finally {App.closeModal();api.source=originals.source;api.thumbnail=originals.thumbnail;api.saveImage=originals.saveImage;App.applyFontScale(originals.scale);}
})();
