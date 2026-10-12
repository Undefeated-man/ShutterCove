/* Synthetic landscape assets keep the published demonstration free of private photos. */
window.createDemoBridge = function () {
  const scenes = [
    ['山川入梦','2025-09-25','山川与湖泊','cyan',['远行','湖泊'],true],
    ['沿着光走','2025-09-25','旷野之旅','orange',['公路','日落'],false],
    ['森林的来信','2025-09-24','山川与湖泊','green',['森林','自然'],true],
    ['暮色温柔','2025-09-24','旷野之旅','purple',['日落','山川'],false],
    ['湖畔的清晨','2025-09-23','山川与湖泊','blue',['湖泊','晨光'],true],
    ['秋日私语','2025-09-23','生活切片','yellow',['秋天','树木'],false],
    ['旷野有风','2025-09-22','旷野之旅','orange',['荒野','山川'],false],
    ['一日慢行','2025-09-22','生活切片','green',['森林','步行'],true],
    ['远山如诗','2025-09-21','山川与湖泊','blue',['雪山','远行'],false],
    ['落日收藏家','2025-09-21','旷野之旅','pink',['日落','湖泊'],false],
    ['听见松风','2025-09-19','生活切片','green',['森林','自然'],false],
    ['金色的边界','2025-09-18','旷野之旅','yellow',['沙漠','荒野'],true],
    ['蓝色时刻','2025-09-14','山川与湖泊','cyan',['湖泊','远行'],false],
    ['晨曦微光','2025-09-12','生活切片','orange',['日落','自然'],false],
    ['山风与我','2025-09-11','山川与湖泊','purple',['山川','旅行'],false],
    ['日常的小岛','2025-09-10','生活切片','neutral',['宁静','湖泊'],false]
  ];
  const palettes = {
    cyan:['#cadbe0','#6fa6a2','#446b6b','#8aa28c'],blue:['#c7d6dc','#94b9cf','#476979','#71867d'],
    orange:['#e4c09e','#c99169','#86664f','#b49a69'],green:['#d8dfc9','#91a889','#4b6b58','#8f996a'],
    purple:['#d1c4d0','#a68b9c','#615e79','#8d828c'],yellow:['#e6d5ae','#c7b775','#85794d','#a39c66'],
    pink:['#e7c6be','#cba6a4','#856c88','#a2a391'],neutral:['#dedfd8','#b7bfbb','#7a8482','#a7ada1']
  };
  function landscape(i) {
    const p=palettes[scenes[i][3]], lake=i%4===0||i%4===1, forest=i%4===2;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" viewBox="0 0 1500 1000"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><rect width="1500" height="1000" fill="url(#sky)"/><circle cx="${1150-i*17}" cy="${210+i%3*50}" r="${i%2?55:80}" fill="#ffefd8" opacity=".53"/><path d="M0 510 140 445 280 480 450 275 630 455 805 315 980 465 1200 315 1390 475 1500 390V1000H0Z" fill="${p[2]}" opacity=".32"/><path d="M0 575 250 480 460 575 680 435 900 565 1100 440 1320 570 1500 490V1000H0Z" fill="${p[2]}" opacity=".57"/>`;
    if(lake) svg+=`<path d="M0 670Q300 575 590 630T1500 640V1000H0Z" fill="url(#water)"/><path d="M0 680Q230 605 590 647T1500 660" fill="none" stroke="${p[3]}" stroke-width="18"/><path d="M0 960Q180 875 340 913T710 1000H0Z" fill="${p[3]}"/><path d="M750 735h500M500 780h340M920 820h220M170 690h240" stroke="${p[0]}" opacity=".16" stroke-width="3"/>`;
    else svg+=`<path d="M0 660Q330 515 660 685T1500 630V1000H0Z" fill="${p[3]}"/><path d="M0 900Q370 720 800 850T1500 810V1000H0Z" fill="${p[2]}" opacity=".75"/>`;
    if(forest){for(let x=0;x<1560;x+=42){let h=110+(x*17%210),y=730+(x%145);svg+=`<path d="M${x} ${y-h}l-${h*.28} ${h*.8}h${h*.15}l-${h*.28} ${h*.4}h${h*.82}l-${h*.28}-${h*.4}h${h*.15}Z" fill="${p[2]}" opacity=".8"/>`;} }
    if(i%4===1)svg+='<path d="M770 1000 784 822 752 720 733 653 722 634 727 637 755 685 812 792 900 1000Z" fill="#e9d8b0" opacity=".85"/><path d="M833 1000 800 814 754 717" fill="none" stroke="#fff4d6" stroke-width="4" stroke-dasharray="16 20" opacity=".7"/>';
    svg+='<rect width="1500" height="1000" fill="transparent" filter="url(#grain)"/><rect width="1500" height="1000" fill="#fff9e1" opacity=".055"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  let photos=scenes.map((s,i)=>({id:'demo-'+i,name:s[0]+'.JPG',stem:s[0],jpegPath:'/演示相册/'+s[0]+'.JPG',rawPath:i%5===3?null:'/演示相册/'+s[0]+'.CR3',path:'/演示相册/'+s[0]+'.JPG',date:s[1],theme:s[2],tags:s[4],favorite:s[5],color:palettes[s[3]][1],colorFamily:s[3],width:6000,height:4000,camera:'Canon EOS R5',lens:'RF 24-70mm F2.8 L IS USM',size:18400000}));
  let settings={language:'zh-CN',languageChosen:true,libraryRoot:'/演示相册',importDestination:'/演示相册',cacheLimitMB:512,fontScale:1.2,checkUpdatesAutomatically:true,editorPaths:{photoshop:'自动检测',lightroom:'自动检测'}};
  const listeners=[];let copyCancelled=false;const copyNames=new Set();
  const emit=p=>listeners.forEach(fn=>fn(p));
  let demoVersion='1.0.7';
  let updateState={status:'idle',currentVersion:demoVersion,latestVersion:null,support:'mac',installSupported:true,progress:null,message:'',releaseURL:null};
  const updateListeners=[];
  const updateSnapshot=()=>({...updateState,progress:updateState.progress?{...updateState.progress}:null});
  const emitUpdate=patch=>{updateState={...updateState,...patch};if(patch.currentVersion)demoVersion=patch.currentVersion;updateListeners.forEach(fn=>fn(updateSnapshot()));return updateSnapshot();};
  const updatePause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  window.timeMachine?.onProgress?.(emit);
  let demoGifRevision=0;
  async function demoGifSources(frames) {
    const sources=[];
    for(const frame of frames){
      if(!/^demo-(?:[0-9]|1[0-5])$/.test(frame.id))throw new Error('请选择合成演示照片');
      const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('演示画面无法读取'));image.src=landscape(Number(frame.id.split('-')[1]));});
      const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;canvas.getContext('2d').drawImage(img,0,0,960,640);sources.push(canvas.toDataURL('image/png'));canvas.width=canvas.height=1;
    }
    return sources;
  }
  return {
    previewGif:async args=>{if(!window.timeMachine?.previewGif)throw new Error('请在时光杂货店桌面 App 中生成 GIF');const revision=++demoGifRevision;const demoSources=await demoGifSources(args.frames);if(revision!==demoGifRevision)return {canceled:true};return window.timeMachine.previewGif({...args,demoSources});},
    saveGif:async args=>window.timeMachine.saveGif(args),cancelGif:async()=>{demoGifRevision++;return window.timeMachine.cancelGif();},releaseGif:async args=>window.timeMachine.releaseGif(args),
    qaEmitProgress:emit,
    qaEmitUpdateState:emitUpdate,
    getUpdateState:async()=>updateSnapshot(),
    onUpdateState:cb=>{updateListeners.push(cb);return()=>{const index=updateListeners.indexOf(cb);if(index>=0)updateListeners.splice(index,1);};},
    checkForUpdates:async()=>{emitUpdate({status:'checking',message:'',progress:null});await updatePause(180);return emitUpdate(demoVersion==='1.0.8'?{status:'upToDate',latestVersion:null,message:''}:{status:'available',latestVersion:'1.0.8',message:'合成演示更新，不联网。'});},
    downloadUpdate:async()=>{if(!updateState.latestVersion)throw new Error('请先检查更新');const totalBytes=120*1024*1024;emitUpdate({status:'downloading',message:'',progress:{percent:0,receivedBytes:0,totalBytes}});for(const percent of [13,38,61,88,100]){await updatePause(160);emitUpdate({status:'downloading',progress:{percent,receivedBytes:totalBytes*percent/100,totalBytes}});}return emitUpdate({status:'ready',message:'演示下载和校验完成，未写入文件。'});},
    installUpdate:async()=>{if(updateState.status!=='ready')throw new Error('更新尚未准备好');const nextVersion=updateState.latestVersion;emitUpdate({status:'installing',message:'演示更新，不退出或替换应用。'});await updatePause(180);return emitUpdate({status:'upToDate',currentVersion:nextVersion,latestVersion:null,progress:null,message:'演示完成；正式软件会在原位置更新。'});},
    isDemo:true,chooseFolder:async()=>'/演示相册',getSettings:async()=>({...settings,currentVersion:demoVersion}),saveSettings:async p=>{if(Object.hasOwn(p,'language')&&!['en','zh-CN'].includes(p.language))throw new Error('Invalid interface language');if(Object.hasOwn(p,'languageChosen')&&typeof p.languageChosen!=='boolean')throw new Error('Invalid language selection state');if(Object.hasOwn(p,'checkUpdatesAutomatically')&&typeof p.checkUpdatesAutomatically!=='boolean')throw new Error('无效的自动检查更新设置');Object.assign(settings,p,{fontScale:Math.max(1,Math.min(1.5,Number(p.fontScale??settings.fontScale)||1.2))});return {...settings,currentVersion:demoVersion};},chooseEditor:async e=>settings.editorPaths[e],
    scan:async root=>({root,photos:[...photos]}),thumbnail:async({id})=>landscape(Number(id.split('-')[1])%scenes.length),source:async({id})=>landscape(Number(id.split('-')[1])%scenes.length),
    update:async({ids,patch})=>{photos=photos.map(p=>ids.includes(p.id)?{...p,...patch,...(patch.addTags?{tags:[...new Set([...(p.tags||[]),...patch.addTags])]}:{})}:p);return photos.filter(p=>ids.includes(p.id));},
    analyzeColors:async({ids})=>{for(let i=0;i<ids.length;i++){emit({kind:'colors',done:i+1,total:ids.length,etaSeconds:0});await new Promise(r=>setTimeout(r,30));}return photos.filter(p=>ids.includes(p.id));},
    similar:async({referenceId,grid})=>{for(let i=0;i<photos.length;i++){emit({kind:'similarity',done:i+1,total:photos.length,etaSeconds:Math.ceil((photos.length-i)/8)});await new Promise(r=>setTimeout(r,50));}return {photos:photos.filter(p=>p.id!==referenceId).map((p,i)=>({...p,similarity:Math.max(.48,.97-i*.027)}))};},
    copySelected:async({ids,directory,destination,includeRaw=false})=>{copyCancelled=false;directory=directory||destination;const copied=[],skipped=[],errors=[];emit({kind:'copy',done:0,total:ids.length});for(let i=0;i<ids.length;i++){if(copyCancelled)break;const p=photos.find(p=>p.id===ids[i]);if(!p){errors.push({id:ids[i],message:'演示照片不存在'});continue;}if(!p.jpegPath&&!includeRaw){skipped.push({id:p.id,name:p.name,reason:'raw-only',message:'仅有 CR3，默认跳过；勾选原片后可复制。'});}else{let suffix=1,stem=p.stem;while(copyNames.has(directory+'/'+stem))stem=p.stem+'-'+(++suffix);copyNames.add(directory+'/'+stem);if(p.jpegPath)copied.push({id:p.id,format:'jpeg',source:p.jpegPath,path:directory+'/'+stem+'.JPG'});if(includeRaw&&p.rawPath)copied.push({id:p.id,format:'raw',source:p.rawPath,path:directory+'/'+stem+'.CR3'});}await new Promise(r=>setTimeout(r,80));emit({kind:'copy',done:i+1,total:ids.length,etaSeconds:0});}return {directory,destination:directory,copied,skipped,errors,cancelled:copyCancelled,copiedCount:copied.length,skippedCount:skipped.length,errorCount:errors.length};},
    syncPreview:async({directory,ids})=>({token:'demo-sync',directory,keepCount:ids.length*2,moveCount:6,kept:ids.flatMap((id,i)=>['DCIM/100CANON/IMG_'+(1000+i)+'.JPG','DCIM/100CANON/IMG_'+(1000+i)+'.CR3']),moves:Array.from({length:6},(_,i)=>({from:'DCIM/100CANON/IMG_'+(2000+Math.floor(i/2))+ (i%2?'.CR3':'.JPG'),to:'待删/演示批次/DCIM/100CANON/IMG_'+(2000+Math.floor(i/2))+(i%2?'.CR3':'.JPG')})),protected:[],protectedCount:0,unmatched:[],ambiguous:[]}),syncFavorites:async()=>({moved:Array.from({length:6},(_,i)=>'演示照片'+i),movedCount:6,kept:[],errors:[],cancelled:false,batchDirectory:'/演示 SD 卡/待删/演示批次'}),revealDirectory:async()=>({demo:true}),cancel:async kind=>{if(kind==='copy')copyCancelled=true;},importPhotos:async()=>({imported:0,skipped:16,demo:true}),reveal:async()=>({demo:true}),openEditor:async()=>({demo:true}),trash:async({ids})=>{photos=photos.filter(p=>!ids.includes(p.id));return {deleted:ids.length};},
    saveImage:async({dataUrl,suggestedName})=>{const a=document.createElement('a');a.href=dataUrl;a.download=suggestedName;a.click();return {path:suggestedName};},
    cacheInfo:async()=>({bytes:0,count:0,limitMB:512}),clearCache:async()=>({cleared:true}),onProgress:cb=>{listeners.push(cb);return()=>listeners.splice(listeners.indexOf(cb),1);}
  };
};
