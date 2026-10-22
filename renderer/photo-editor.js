'use strict';
(() => {
  const E=window.ColorEngine, t=(s,v)=>window.I18n?.t(s,v)||s;
  // Pixel reads and undo must use the same raster backend before and after an
  // export; switching GPU/CPU resampling can otherwise subtly change previews.
  const c=(w,h)=>{const x=document.createElement('canvas');x.width=Math.max(1,Math.round(w));x.height=Math.max(1,Math.round(h));x.getContext('2d',{willReadFrequently:true});return x;};
  const fit=(w,h,side=24000,pixels=48000000)=>{const k=Math.min(1,side/w,side/h,Math.sqrt(pixels/w/h));return [Math.max(1,Math.floor(w*k)),Math.max(1,Math.floor(h*k))];};
  const names={master:'明暗 RGB',red:'红 ↔ 青',green:'绿 ↔ 洋红',blue:'蓝 ↔ 黄',temperature:'色温 · 蓝黄',tint:'色调 · 绿洋红'};
  const inks={master:'#52776c',red:'#ba5c53',green:'#54835f',blue:'#557fc2',temperature:'#b58a41',tint:'#a3679e'};
  let opening=0;
  async function edit(photo) {
    const {api,modal,run,toast,closeModal,refresh,state,confirmAction}=window.App;
    const epoch=state.creationEpoch,ticket=++opening;
    toast(t('正在载入原尺寸照片…'));
    const url=await api.source({id:photo.id,format:'jpeg'});
    const original=await new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(t('照片预览加载失败，请检查原文件是否在线')));i.src=typeof url==='string'?url:url.url;});
    if(ticket!==opening||state.creationEpoch!==epoch)return;
    const [initialW,initialH]=fit(original.naturalWidth,original.naturalHeight);
    let base=c(initialW,initialH);base.getContext('2d').drawImage(original,0,0,initialW,initialH);
    let settings=E.defaults(),history=[],future=[],channel='master',selected=0,tool='',shape='rect',region=null,drag=null;
    let disposed=false,saving=false,compare=false,mask=false,analysis=null,sourceVersion=0,ready=false,renderToken=0,rendering=false,pendingRender=false;
    let sampleCanvas=null,samplePixels=null,zoom=1,panX=0,panY=0,graphDrag=null,removeLanguage,workerError=null;
    const worker=new Worker('color-worker.js'),requests=new Map();let serial=0;
    function request(payload,transfer=[]) {return new Promise((resolve,reject)=>{const id=++serial;requests.set(id,{resolve,reject});worker.postMessage({...payload,id},transfer);});}
    worker.onmessage=({data})=>{const task=requests.get(data.id);if(!task)return;requests.delete(data.id);data.error?task.reject(new Error(data.error)):task.resolve(data);};
    worker.onerror=()=>{workerError=new Error(t('调色预览未能完成，请关闭编辑器后重试'));for(const p of requests.values())p.reject(workerError);requests.clear();};
    const node=modal({title:'光影调色室',subtitleIsData:true,subtitle:photo.name,large:true,body:`
      <div class="color-editor-layout">
        <div class="color-editor-image"><div class="editor-viewbar"><button class="button quiet" id="edit-fit">适应画面</button><span id="edit-zoom" data-i18n-ignore>100%</span><button class="button quiet" id="edit-compare" aria-pressed="false">对比调色前</button></div>
          <div class="studio-preview editor-stage" id="edit-preview" tabindex="0" aria-label="照片编辑画布"><canvas id="edit-canvas"></canvas><div class="crop-overlay" id="crop-overlay" hidden></div><span class="editor-view-label" id="edit-view-label" hidden></span></div>
          <p class="help-text">Alt / Option + 滚轮放大 · 手掌模式拖动查看细节</p><div class="studio-status" id="edit-status" role="status" aria-live="polite"></div>
        </div>
        <aside class="studio-tools color-editor-tools" aria-label="调色与修图工具">
          <section class="editor-section skin-section"><div class="editor-section-heading"><h4>自然肤色</h4><span class="local-pill">本地处理</span></div>
            <button class="button primary skin-auto" id="skin-auto">✧ AI 一键通透</button><p class="help-text">分析肤色范围，柔和提亮中间调、收敛偏色，保留皮肤纹理。</p>
            <label class="editor-slider-label" for="skin-strength">通透强度 <output id="skin-strength-value" data-i18n-ignore>0%</output></label><input type="range" id="skin-strength" min="0" max="100" value="0">
            <div class="tool-row"><button class="button quiet" id="skin-pick" aria-pressed="false">取样肤色</button><button class="button quiet" id="skin-mask" aria-pressed="false">查看范围</button><button class="link-button" id="skin-clear">自动范围</button></div>
            <small id="skin-report" role="status"></small><p class="help-text skin-caveat">按颜色识别，相近色背景也可能被调整。可取样并查看范围；所有处理均在本机完成。</p>
          </section>
          <section class="editor-section"><div class="editor-section-heading"><h4>色彩曲线</h4><button class="link-button" id="curve-reset">重置此曲线</button></div>
            <div class="curve-channels" role="group" aria-label="曲线通道">${E.channels.map(k=>`<button class="curve-channel" data-channel="${k}" aria-pressed="${k==='master'}" style="--channel-ink:${inks[k]}">${names[k]}</button>`).join('')}</div>
            <div class="curve-plot"><svg id="color-curve" viewBox="0 0 288 240" role="group" aria-label="点击曲线添加节点，拖动调整" aria-describedby="curve-help"></svg></div>
            <div class="curve-node-controls"><label for="curve-input">输入 <input id="curve-input" type="number" min="0" max="255" step="1"></label><label for="curve-output"><span id="curve-output-label">输出</span><input id="curve-output" type="number" min="0" max="255" step="1"></label><button class="button quiet" id="curve-delete">删除节点</button></div>
            <button class="link-button" id="curve-add">＋ 添加中间节点</button><p class="help-text" id="curve-help">点击加点，拖动调节。方向键微调，Shift 加速；Delete 或双击删除节点。</p><small id="curve-direction"></small>
          </section>
          <section class="editor-section"><div class="editor-section-heading"><h4>白平衡偏移</h4><button class="link-button" id="balance-reset">归零</button></div>
            <label class="editor-slider-label" for="edit-temperature">色温 · 蓝 → 黄 <output id="temperature-value" data-i18n-ignore>0</output></label><input class="temperature-slider" id="edit-temperature" type="range" min="-100" max="100" value="0">
            <label class="editor-slider-label" for="edit-tint">色调 · 绿 → 洋红 <output id="tint-value" data-i18n-ignore>0</output></label><input class="tint-slider" id="edit-tint" type="range" min="-100" max="100" value="0"><small>偏移曲线可分别调整暗部、中间调与亮部；零线保持原色。JPEG 使用相对偏移值。</small>
          </section>
          <section class="editor-section color-reference"><h4>互补色盘参考</h4><div class="color-reference-body"><div class="complement-wheel" id="complement-wheel" role="slider" tabindex="0" aria-label="互补色参考色相" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"><div class="wheel-center"></div><svg viewBox="0 0 120 120" aria-hidden="true"><line id="complement-line" x1="60" y1="12" x2="60" y2="108"/><circle id="complement-dot-a" cx="60" cy="12" r="6"/><circle id="complement-dot-b" cx="60" cy="108" r="6"/></svg></div><div class="complement-pairs"><button data-pair="red">红 ↔ 青</button><button data-pair="green">绿 ↔ 洋红</button><button data-pair="blue">蓝 ↔ 黄</button></div></div><div class="complement-swatches" data-i18n-ignore><span id="complement-a"></span><span id="complement-b"></span></div><p class="help-text">相对的颜色互为参考。通道曲线上提增加该颜色，下压偏向它的互补色。</p></section>
          <details class="editor-section editor-geometry"><summary>裁剪、旋转与马赛克</summary><div class="geometry-content"><div class="tool-row"><button class="button quiet" id="rotate-left">↶ 左转</button><button class="button quiet" id="rotate-right">↷ 右转</button></div><div class="tool-row"><button class="button quiet" id="flip-horizontal">↔ 左右镜像</button><button class="button quiet" id="flip-vertical">↕ 上下镜像</button></div><div class="tool-row"><button class="button quiet" id="edit-hand">手掌模式</button><button class="button quiet" id="crop-tool">▣ 框选裁剪</button><button class="button quiet" id="apply-crop">应用裁剪</button></div><p class="help-text">在照片上拖出保留区域，再应用裁剪。</p><div class="tool-row"><button class="button quiet" id="mosaic-rect">▢ 矩形</button><button class="button quiet" id="mosaic-ellipse">◯ 椭圆</button></div><label for="mosaic-size">像素块尺寸</label><input type="range" id="mosaic-size" min="8" max="120" value="36"></div></details>
        </aside>
      </div>`,footer:'<div class="editor-history"><button class="button quiet" id="edit-undo">↶ 撤销</button><button class="button quiet" id="edit-redo">↷ 重做</button><button class="link-button" id="edit-reset">重置原片</button></div><button class="button quiet" id="edit-overwrite">覆盖 JPEG 原片</button><button class="button primary" id="edit-save-as">另存为新照片</button>',onClose:()=>{
        disposed=true;worker.terminate();for(const p of requests.values())p.reject(new Error('Editor closed'));requests.clear();removeLanguage?.();resize.disconnect();
        for(const image of new Set([base,...history.map(s=>s.base),...future.map(s=>s.base),sampleCanvas,display]))if(image)image.width=image.height=1;
        history=[];future=[];samplePixels=null;original.src='';
      }});
    node.querySelector('.modal').classList.add('photo-editor');
    const el=id=>node.querySelector('#'+id),display=el('edit-canvas'),preview=el('edit-preview'),overlay=el('crop-overlay'),graph=el('color-curve');
    const toolsPanel=node.querySelector('.color-editor-tools'),curvesSection=graph.closest('section'),reference=node.querySelector('.color-reference');
    curvesSection.insertBefore(reference,curvesSection.querySelector('.curve-plot'));
    const panels={color:[curvesSection,el('balance-reset').closest('section')],skin:[el('skin-auto').closest('section')],geometry:[node.querySelector('.editor-geometry')]};
    const tabs=document.createElement('div');tabs.className='editor-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',t('调色与修图工具'));toolsPanel.prepend(tabs);
    for(const [key,sections] of Object.entries(panels)){
      const tab=document.createElement('button');tab.id='edit-tab-'+key;tab.textContent={color:'曲线调色',skin:'肤色通透',geometry:'裁剪修图'}[key];tab.setAttribute('role','tab');tab.setAttribute('aria-controls','edit-panel-'+key);tab.dataset.editTab=key;tabs.append(tab);
      const panel=document.createElement('div');panel.id='edit-panel-'+key;panel.className='editor-tool-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.append(...sections);toolsPanel.append(panel);
      tab.onclick=()=>selectPanel(key);
    }
    function selectPanel(key){for(const tab of tabs.children){const active=tab.dataset.editTab===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;el('edit-panel-'+tab.dataset.editTab).hidden=!active;}if(key==='geometry')node.querySelector('.editor-geometry').open=true;toolsPanel.scrollTop=0;}
    tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const keys=Object.keys(panels),at=keys.indexOf(event.target.dataset.editTab),next=event.key==='Home'?0:event.key==='End'?2:(at+(event.key==='ArrowRight'?1:2))%3;selectPanel(keys[next]);el('edit-tab-'+keys[next]).focus();};
    selectPanel('color');
    function capture(){return {base,settings:structuredClone(settings)};}
    function prune(extra=[]) {
      while(history.length>40)extra.push(history.shift().base);
      while(new Set([base,...history.map(s=>s.base)]).size>1&&[...new Set([base,...history.map(s=>s.base)])].reduce((n,c)=>n+c.width*c.height,0)>96000000)extra.push(history.shift().base);
      const keep=new Set([base,...history.map(s=>s.base),...future.map(s=>s.base)]);
      for(const image of new Set(extra))if(!keep.has(image))image.width=image.height=1;
    }
    function remember(){history.push(capture());const old=future.map(s=>s.base);future=[];prune(old);syncHistory();}
    function syncHistory(){el('edit-undo').disabled=saving||!history.length;el('edit-redo').disabled=saving||!future.length;}
    function stateChanged(){renderToken++;compare=false;el('edit-compare').setAttribute('aria-pressed','false');syncControls();drawGraph();schedule();}
    function status(text){el('edit-status').textContent=text||`${base.width.toLocaleString()} × ${base.height.toLocaleString()} px · ${t('预览按需缩放，保存应用完整尺寸调色')} · ${t(tool==='crop'?'拖动框选裁剪区域':tool==='mosaic'?'拖动添加马赛克':'选择工具开始编辑')}${initialW<original.naturalWidth||initialH<original.naturalHeight?' · '+t('超大原片已缩小到安全画布'):''}`;}
    function view(){const box=preview.getBoundingClientRect(),scale=Math.min((box.width-24)/display.width,(box.height-24)/display.height),bw=display.width*scale,bh=display.height*scale;panX=Math.max(-Math.max(0,(bw*zoom-box.width)/2+12),Math.min(Math.max(0,(bw*zoom-box.width)/2+12),panX));panY=Math.max(-Math.max(0,(bh*zoom-box.height)/2+12),Math.min(Math.max(0,(bh*zoom-box.height)/2+12),panY));display.style.width=bw+'px';display.style.height=bh+'px';display.style.transform=`translate(-50%,-50%) translate(${panX}px,${panY}px) scale(${zoom})`;preview.dataset.zoom=String(zoom);el('edit-zoom').textContent=Math.round(zoom*100)+'%';}
    function resetView(){zoom=1;panX=panY=0;view();}
    function showPixels(pixels){display.getContext('2d').putImageData(new ImageData(pixels,display.width,display.height),0,0);view();}
    function label(){const text=compare?t('调色前'):mask?t('青色显示调整范围'):'';el('edit-view-label').textContent=text;el('edit-view-label').hidden=!text;el('edit-compare').setAttribute('aria-pressed',String(compare));el('skin-mask').setAttribute('aria-pressed',String(mask));}
    function syncControls(){el('skin-strength').value=settings.skin;el('skin-strength-value').textContent=settings.skin+'%';for(const key of ['temperature','tint']){el('edit-'+key).value=settings[key];el(key+'-value').textContent=(settings[key]>0?'+':'')+settings[key];}node.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));syncHistory();label();}
    function skinReport(){el('skin-report').textContent=!analysis?t('正在分析色彩…'):analysis.found?t(settings.sample?'已使用取样肤色 · 可查看调整范围':'已分析肤色范围 · 可调整通透强度'):t('未找到稳定肤色范围，请点击皮肤取样');el('skin-auto').disabled=saving||!analysis||!!workerError;}
    async function rebuild(){const version=++sourceVersion;renderToken++;ready=false;region=null;overlay.hidden=true;analysis=null;skinReport();
      if(sampleCanvas)sampleCanvas.width=sampleCanvas.height=1;const [w,h]=fit(base.width,base.height,1600,1600000);sampleCanvas=c(w,h);sampleCanvas.getContext('2d',{willReadFrequently:true}).drawImage(base,0,0,w,h);samplePixels=sampleCanvas.getContext('2d').getImageData(0,0,w,h).data;display.width=w;display.height=h;showPixels(samplePixels);resetView();status();
      const buffer=samplePixels.slice().buffer;
      try{const result=await request({kind:'source',buffer,width:w,height:h},[buffer]);if(disposed||version!==sourceVersion)return;analysis=result.analysis;ready=true;skinReport();drawGraph();schedule();}catch(error){if(!disposed){workerError=error;status(t('调色预览未能完成，请关闭编辑器后重试'));}}
    }
    function schedule(){pendingRender=true;if(disposed||!ready||rendering||saving)return;if(compare){showPixels(samplePixels);pendingRender=false;label();return;}void renderPreview();}
    async function renderPreview(){pendingRender=false;rendering=true;const version=sourceVersion,token=renderToken;node.dataset.colorBusy='true';
      try{const result=await request({kind:'render',settings:structuredClone(settings),mask});if(!disposed&&version===sourceVersion&&token===renderToken&&!compare){analysis=result.analysis;showPixels(new Uint8ClampedArray(result.buffer));skinReport();drawGraph();label();status();}}
      catch(error){if(!disposed){workerError=error;status(t('调色预览未能完成，请关闭编辑器后重试'));}}
      finally{rendering=false;node.dataset.colorBusy='false';if(!disposed&&pendingRender)schedule();}
    }
    function chooseChannel(key){channel=key;selected=Math.min(selected,settings.curves[key].length-1);syncControls();drawGraph();if(key!=='master')wheel({red:0,green:120,blue:240,temperature:60,tint:300}[key]);}
    const x=v=>24+v*240,y=v=>216-v*192;
    function drawGraph(){const hadFocus=graph.contains(document.activeElement),pts=settings.curves[channel];selected=Math.max(0,Math.min(selected,pts.length-1));const selectedPoint=pts[selected],lut=E.curve(pts,channel),balance=E.isBalance(channel),index={master:0,red:1,green:2,blue:3}[channel]||0,hist=analysis?.histogram[index]||new Array(256).fill(0),max=Math.max(1,...hist),svg=[];
      svg.push('<rect x="24" y="24" width="240" height="192" rx="5" class="curve-surface"/>');
      for(let i=0;i<5;i++)svg.push(`<path d="M ${x(i/4)} 24 V 216 M24 ${y(i/4)} H264" class="curve-grid"/>`);
      svg.push(`<path d="M24 216 ${hist.map((n,i)=>`L${x(i/255).toFixed(2)} ${(216-155*Math.sqrt(n/max)).toFixed(2)}`).join(' ')} L264 216Z" class="curve-histogram"/>`);
      svg.push(`<path d="M24 ${balance?120:216} L264 ${balance?120:24}" class="curve-neutral"/>`);
      svg.push(`<path d="${Array.from(lut,(v,i)=>(i?'L':'M')+x(i/255).toFixed(2)+' '+y(v).toFixed(2)).join(' ')}" fill="none" stroke="${inks[channel]}" stroke-width="2.5"/>`);
      pts.forEach((p,i)=>svg.push(`<circle data-node="${i}" cx="${x(p.x)}" cy="${y(p.y)}" r="${i===selected?6:4.5}" fill="${i===selected?inks[channel]:'#fff'}" stroke="${inks[channel]}" stroke-width="2" tabindex="0" role="button" aria-label="${t('曲线节点 {number}',{number:i+1})}"/>`));
      svg.push(`<text x="24" y="236">${t('暗部')}</text><text x="264" y="236" text-anchor="end">${t('亮部')}</text><text x="24" y="15">${t(balance?(channel==='temperature'?'上方偏暖黄':'上方偏洋红'):'输出亮度')}</text>`);graph.innerHTML=svg.join('');
      el('curve-input').value=Math.round(selectedPoint.x*255);el('curve-input').disabled=saving||selected===0||selected===pts.length-1;
      el('curve-output').min=balance?-100:0;el('curve-output').max=balance?100:255;el('curve-output').value=Math.round(balance?(selectedPoint.y-.5)*200:selectedPoint.y*255);el('curve-output-label').textContent=t(balance?'偏移':'输出');
      el('curve-delete').disabled=saving||selected===0||selected===pts.length-1;el('curve-add').disabled=saving||pts.length>=16;
      el('curve-direction').textContent=t({master:'上提变亮，下压变暗；横轴是调整前的亮度。',red:'上提增加红，下压增加青。',green:'上提增加绿，下压增加洋红。',blue:'上提增加蓝，下压增加黄。',temperature:'上提偏暖黄，下压偏冷蓝；横轴是原图亮度。',tint:'上提偏洋红，下压偏绿；横轴是原图亮度。'}[channel]);
      if(hadFocus)graph.querySelector(`[data-node="${selected}"]`)?.focus({preventScroll:true});
    }
    function coordinate(event){const r=graph.getBoundingClientRect();return {x:Math.max(0,Math.min(1,((event.clientX-r.left)/r.width*288-24)/240)),y:Math.max(0,Math.min(1,(216-(event.clientY-r.top)/r.height*240)/192))};}
    function moveNode(p){const pts=settings.curves[channel];p.x=selected===0?0:selected===pts.length-1?1:Math.max(pts[selected-1].x+1/255,Math.min(pts[selected+1].x-1/255,p.x));pts[selected]={x:p.x,y:Math.max(0,Math.min(1,p.y))};stateChanged();}
    function addNode(p){const pts=settings.curves[channel];let closest=pts.findIndex(q=>Math.abs(p.x-q.x)<1/255);if(closest>=0){selected=closest;return;}if(pts.length>=16)return;pts.push(p);pts.sort((a,b)=>a.x-b.x);selected=pts.indexOf(p);}
    graph.onpointerdown=event=>{if(saving||event.button!==0)return;event.preventDefault();remember();const hit=event.target.closest('[data-node]');if(hit)selected=+hit.dataset.node;else addNode(coordinate(event));graphDrag={id:event.pointerId};try{graph.setPointerCapture(event.pointerId);}catch{}stateChanged();};
    graph.onpointermove=event=>{if(graphDrag?.id===event.pointerId)moveNode(coordinate(event));};
    graph.onpointerup=event=>{if(graphDrag?.id!==event.pointerId)return;graphDrag=null;try{graph.releasePointerCapture(event.pointerId);}catch{}graph.querySelector(`[data-node="${selected}"]`)?.focus({preventScroll:true});};
    graph.onpointercancel=()=>{if(graphDrag){graphDrag=null;undo();}};
    function removeNode(){const pts=settings.curves[channel];if(saving||selected===0||selected===pts.length-1)return;remember();pts.splice(selected,1);selected--;stateChanged();}
    graph.ondblclick=event=>{const hit=event.target.closest('[data-node]');if(hit){selected=+hit.dataset.node;removeNode();}};
    graph.onfocusin=event=>{const hit=event.target.closest('[data-node]');if(hit&&selected!==+hit.dataset.node){selected=+hit.dataset.node;drawGraph();graph.querySelector(`[data-node="${selected}"]`)?.focus({preventScroll:true});}};
    graph.onkeydown=event=>{if(saving)return;if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();removeNode();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();remember();const p={...settings.curves[channel][selected]},step=(event.shiftKey?10:1)/255;if(event.key==='ArrowLeft')p.x-=step;if(event.key==='ArrowRight')p.x+=step;if(event.key==='ArrowUp')p.y+=step;if(event.key==='ArrowDown')p.y-=step;moveNode(p);graph.querySelector(`[data-node="${selected}"]`)?.focus({preventScroll:true});};
    el('curve-delete').onclick=removeNode;el('curve-add').onclick=()=>{remember();const pts=settings.curves[channel];let j=0;for(let i=1;i<pts.length-1;i++)if(pts[i+1].x-pts[i].x>pts[j+1].x-pts[j].x)j=i;const xx=(pts[j].x+pts[j+1].x)/2;addNode({x:xx,y:E.curve(pts,channel)[Math.round(xx*255)]});stateChanged();graph.querySelector(`[data-node="${selected}"]`)?.focus();};
    for(const axis of ['input','output'])el('curve-'+axis).onchange=event=>{const value=event.target.valueAsNumber;if(!Number.isFinite(value)){drawGraph();return;}remember();const p={...settings.curves[channel][selected]};if(axis==='input')p.x=value/255;else p.y=E.isBalance(channel)?value/200+.5:value/255;moveNode(p);};
    node.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>chooseChannel(b.dataset.channel));
    el('curve-reset').onclick=()=>{remember();settings.curves[channel]=E.identity(channel);selected=0;stateChanged();};
    for(const [id,key] of [['skin-strength','skin'],['edit-temperature','temperature'],['edit-tint','tint']]){let changing=false;const begin=()=>{if(!changing){remember();changing=true;}};el(id).onpointerdown=begin;el(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))begin();};el(id).oninput=()=>{begin();settings[key]=Number(el(id).value);stateChanged();};el(id).onchange=()=>{changing=false;};el(id).onblur=()=>{changing=false;};}
    el('balance-reset').onclick=()=>{remember();settings.temperature=settings.tint=0;settings.curves.temperature=E.identity('temperature');settings.curves.tint=E.identity('tint');stateChanged();};
    el('skin-auto').onclick=()=>{if(!analysis?.found)return toast(t('未找到稳定肤色范围，请点击皮肤取样'));remember();settings.skin=65;mask=false;tool='';el('skin-pick').setAttribute('aria-pressed','false');stateChanged();};
    el('skin-pick').onclick=()=>{tool=tool==='skin'?'':'skin';el('skin-pick').setAttribute('aria-pressed',String(tool==='skin'));preview.style.cursor=tool==='skin'?'crosshair':'grab';status(tool==='skin'?t('点击照片中的皮肤，取样后可点击一键通透'):null);};
    el('skin-mask').onclick=()=>{mask=!mask;compare=false;renderToken++;syncControls();schedule();};
    el('skin-clear').onclick=()=>{remember();settings.sample=null;stateChanged();};
    let hue=0;
    function wheel(value){hue=((value%360)+360)%360;const rad=(hue-90)*Math.PI/180,dx=Math.cos(rad)*48,dy=Math.sin(rad)*48;el('complement-line').setAttribute('x1',60+dx);el('complement-line').setAttribute('y1',60+dy);el('complement-line').setAttribute('x2',60-dx);el('complement-line').setAttribute('y2',60-dy);for(const [id,sign,h] of [['a',1,hue],['b',-1,(hue+180)%360]]){const dot=el('complement-dot-'+id);dot.setAttribute('cx',60+dx*sign);dot.setAttribute('cy',60+dy*sign);dot.style.fill=`hsl(${h} 75% 55%)`;const swatch=el('complement-'+id);swatch.style.setProperty('--swatch',`hsl(${h} 75% 55%)`);swatch.textContent=Math.round(h)+'°';}el('complement-wheel').setAttribute('aria-valuenow',String(Math.round(hue)));}
    el('complement-wheel').onpointerdown=event=>{const r=event.currentTarget.getBoundingClientRect();wheel(Math.atan2(event.clientY-r.top-r.height/2,event.clientX-r.left-r.width/2)*180/Math.PI+90);};
    el('complement-wheel').onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();wheel(hue+(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1)*(event.shiftKey?10:1));};
    node.querySelectorAll('[data-pair]').forEach(b=>b.onclick=()=>chooseChannel(b.dataset.pair));
    function chooseTool(key,mosaicShape){tool=key;shape=mosaicShape||shape;region=null;overlay.hidden=true;preview.style.cursor=tool?'crosshair':'grab';node.querySelectorAll('#crop-tool,#mosaic-rect,#mosaic-ellipse').forEach(b=>b.classList.toggle('active',key==='crop'?b.id==='crop-tool':key==='mosaic'&&b.id==='mosaic-'+shape));status(tool==='crop'?t('拖动框选裁剪区域'):null);}
    function point(event){const box=display.getBoundingClientRect();return{x:Math.max(0,Math.min(base.width,(event.clientX-box.left)/box.width*base.width)),y:Math.max(0,Math.min(base.height,(event.clientY-box.top)/box.height*base.height))};}
    function selection(a,b){const xx=Math.round(Math.min(a.x,b.x)),yy=Math.round(Math.min(a.y,b.y));return{x:xx,y:yy,w:Math.min(base.width-xx,Math.round(Math.abs(a.x-b.x))),h:Math.min(base.height-yy,Math.round(Math.abs(a.y-b.y)))};}
    function showRegion(r){const box=display.getBoundingClientRect(),container=preview.getBoundingClientRect();overlay.hidden=false;Object.assign(overlay.style,{left:box.left-container.left+r.x/base.width*box.width+'px',top:box.top-container.top+r.y/base.height*box.height+'px',width:r.w/base.width*box.width+'px',height:r.h/base.height*box.height+'px',borderRadius:tool==='mosaic'&&shape==='ellipse'?'50%':'0'});}
    function setBase(next){const old=base;base=next;prune([old]);void rebuild();syncControls();}
    for(const id of ['rotate-left','rotate-right','flip-horizontal','flip-vertical'])el(id).onclick=()=>{if(saving)return;remember();const next=c(id.startsWith('rotate')?base.height:base.width,id.startsWith('rotate')?base.width:base.height),ctx=next.getContext('2d');if(id==='rotate-left'){ctx.translate(0,next.height);ctx.rotate(-Math.PI/2);}if(id==='rotate-right'){ctx.translate(next.width,0);ctx.rotate(Math.PI/2);}if(id==='flip-horizontal'){ctx.translate(next.width,0);ctx.scale(-1,1);}if(id==='flip-vertical'){ctx.translate(0,next.height);ctx.scale(1,-1);}ctx.drawImage(base,0,0);setBase(next);};
    el('crop-tool').onclick=()=>chooseTool('crop');el('mosaic-rect').onclick=()=>chooseTool('mosaic','rect');el('mosaic-ellipse').onclick=()=>chooseTool('mosaic','ellipse');el('edit-hand').onclick=()=>chooseTool('');
    display.onpointerdown=event=>{if(saving||event.button>0)return;const p=point(event);if(tool==='skin'){remember();const sx=Math.min(base.width-1,Math.floor(p.x)),sy=Math.min(base.height-1,Math.floor(p.y)),block=base.getContext('2d').getImageData(Math.max(0,sx-2),Math.max(0,sy-2),Math.min(5,base.width-Math.max(0,sx-2)),Math.min(5,base.height-Math.max(0,sy-2))).data,sums=[0,0,0];for(let i=0;i<block.length;i+=4)for(let j=0;j<3;j++)sums[j]+=block[i+j];settings.sample=sums.map(n=>n/(block.length/4));tool='';el('skin-pick').setAttribute('aria-pressed','false');stateChanged();return;}drag={...p,clientX:event.clientX,clientY:event.clientY,panX,panY};try{display.setPointerCapture(event.pointerId);}catch{}};
    display.onpointermove=event=>{if(!drag)return;if(!tool){panX=drag.panX+event.clientX-drag.clientX;panY=drag.panY+event.clientY-drag.clientY;view();return;}region=selection(drag,point(event));showRegion(region);};
    display.onpointerup=event=>{if(!drag)return;if(!tool){drag=null;return;}region=selection(drag,point(event));drag=null;if(region.w<4||region.h<4){overlay.hidden=true;region=null;return;}if(tool==='mosaic'){remember();const r=region,block=Number(el('mosaic-size').value),small=c(Math.ceil(r.w/block),Math.ceil(r.h/block)),next=c(base.width,base.height),ctx=next.getContext('2d');ctx.drawImage(base,0,0);small.getContext('2d').drawImage(base,r.x,r.y,r.w,r.h,0,0,small.width,small.height);ctx.save();if(shape==='ellipse'){ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.y+r.h/2,r.w/2,r.h/2,0,0,Math.PI*2);ctx.clip();}ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,small.width,small.height,r.x,r.y,r.w,r.h);ctx.restore();small.width=small.height=1;setBase(next);}};
    display.onpointercancel=()=>{drag=null;region=null;overlay.hidden=true;};
    el('apply-crop').onclick=()=>{if(!region||region.w<4||region.h<4)return toast(t('先在照片上拖动框选要保留的区域'));remember();const r=region,next=c(r.w,r.h);next.getContext('2d').drawImage(base,r.x,r.y,r.w,r.h,0,0,r.w,r.h);setBase(next);};
    function restore(from,to){if(saving||!from.length)return;to.push(capture());const old=base,item=from.pop();base=item.base;settings=structuredClone(item.settings);selected=0;mask=compare=false;prune([old]);syncControls();drawGraph();void rebuild();}
    function undo(){restore(history,future);}el('edit-undo').onclick=undo;el('edit-redo').onclick=()=>restore(future,history);
    el('edit-reset').onclick=()=>{remember();settings=E.defaults();mask=compare=false;selected=0;const next=c(initialW,initialH);next.getContext('2d').drawImage(original,0,0,initialW,initialH);setBase(next);drawGraph();};
    el('edit-fit').onclick=resetView;el('edit-compare').onclick=()=>{compare=!compare;renderToken++;label();schedule();};
    preview.addEventListener('wheel',event=>{if(!event.altKey||saving)return;event.preventDefault();event.stopPropagation();const next=Math.max(1,Math.min(12,zoom*Math.exp(-event.deltaY*.0025))),box=preview.getBoundingClientRect(),xx=event.clientX-box.left-box.width/2,yy=event.clientY-box.top-box.height/2;panX=xx-(xx-panX)*next/zoom;panY=yy-(yy-panY)*next/zoom;zoom=next;if(zoom===1)panX=panY=0;view();region=null;overlay.hidden=true;},{passive:false});
    const resize=new ResizeObserver(()=>{view();region=null;overlay.hidden=true;});resize.observe(preview);
    async function save(overwrite){if(saving||disposed)return;if(workerError)throw workerError;saving=true;node.querySelectorAll('button,input').forEach(b=>b.disabled=true);node.querySelector('.modal-close').disabled=false;status(t('正在以完整尺寸应用调色…'));
      try{while((rendering||!ready)&&!disposed&&!workerError)await new Promise(r=>setTimeout(r,20));if(disposed)return;if(workerError)throw workerError;
        const current=structuredClone(settings),version=sourceVersion;
        // Refresh analysis for the final settings, then reuse precisely that
        // profile at full resolution. Comparison/mask views never affect export.
        await request({kind:'render',settings:current,mask:false});if(disposed||sourceVersion!==version)return;
        const pixels=base.getContext('2d').getImageData(0,0,base.width,base.height);const result=await request({kind:'export',buffer:pixels.data.buffer,width:base.width,height:base.height,settings:current},[pixels.data.buffer]);if(disposed)return;
        const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(new Blob([result.buffer],{type:result.mime}));});if(disposed)return;
        if(overwrite&&api.isDemo&&!await confirmAction(t('覆盖 JPEG 原片？'),t('将用当前编辑结果替换 JPEG。覆盖无法在软件中撤销；CR3 不会更改，导出的 JPEG 不保留原 EXIF。'),t('确认覆盖'),true))return;
        const saved=await api.saveImage({dataUrl,suggestedName:(photo.stem||photo.name.replace(/\.[^.]+$/,''))+'-拾光编辑.jpg',...(overwrite?{overwriteId:photo.id}:{})});if(disposed||saved?.canceled)return;closeModal();toast(t(overwrite?'JPEG 已覆盖，CR3 原片保留':'新的光影已另存为照片'));if(state.root)await refresh();
      }finally{saving=false;if(!disposed){node.querySelectorAll('button,input').forEach(b=>b.disabled=false);syncControls();drawGraph();skinReport();status();schedule();}}
    }
    el('edit-save-as').onclick=()=>run(()=>save(false));el('edit-overwrite').onclick=()=>run(()=>save(true));
    removeLanguage=window.I18n?.onChange(()=>{syncControls();drawGraph();skinReport();status();window.I18n.apply(node);});
    wheel(0);syncControls();drawGraph();window.I18n?.apply(node);await rebuild();
  }
  window.PhotoEditor={edit};
})();
