(async()=>{
  const checks=[],assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label);};
  const wait=async fn=>{const end=Date.now()+15000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,40));}throw new Error('Native creative fixture not ready');};
  await wait(()=>window.App?.state?.photos?.length>=2);
  const api=window.timeMachine, photos=App.state.photos.filter(p=>p.jpegPath);
  assert(!App.api.isDemo,'Production creative IPC');
  const digest=async dataUrl=>{const bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');};
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,160,100);gradient.addColorStop(0,'#467a69');gradient.addColorStop(1,'#eed9b3');ctx.fillStyle=gradient;ctx.fillRect(0,0,160,100);ctx.fillStyle='#fff';ctx.fillRect(10,20,30,40);
  const jpeg=canvas.toDataURL('image/jpeg',.8), shareSHA256=await digest(jpeg);
  const saved=await api.saveImage({dataUrl:jpeg,suggestedName:'synthetic-share-exact.jpg',preserveEncoding:true});assert(!saved.canceled,'Exact share JPEG saved');
  const frames=photos.slice(0,2).map((p,i)=>({id:p.id,overlays:[{type:i?'text':'speech',text:i?'光影 · 02':'你好，山川',x:.1,y:.08,width:.65,font:.07,color:'#253c35',fill:'#fffaf0'}]}));
  const gif=await api.previewGif({frames,width:160,height:100,delay:320,colors:128,loop:true,background:'#faf7ee'});
  assert(gif.frames===2&&gif.width===160&&gif.height===100&&gif.dataUrl.startsWith('data:image/gif;base64,'),'Native two-frame GIF preview');
  const gifSHA256=await digest(gif.dataUrl);
  const output=await api.saveGif({token:gif.token,suggestedName:'synthetic-motion.gif'});assert(!output.canceled&&output.size===gif.size,'GIF token saved without reencoding');
  await api.releaseGif({token:gif.token});let rejected=false;try{await api.saveGif({token:gif.token,suggestedName:'expired.gif'});}catch{rejected=true;}assert(rejected,'Released preview cannot be saved');
  rejected=false;try{await api.previewGif({frames:[{id:photos[0].id,path:'/outside.jpg'},frames[1]],width:160,height:100,delay:320,colors:128,loop:true});}catch{rejected=true;}assert(rejected,'Arbitrary source path rejected');
  return {passed:checks.length,checks,shareSHA256,gifSHA256};
})()
