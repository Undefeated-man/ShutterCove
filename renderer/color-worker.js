'use strict';
importScripts('color-engine.js');
let source=null,analysis=null,sampleKey='';
onmessage=async event=>{
  const {id,kind,buffer,width,height,settings,mask}=event.data;
  try {
    if(kind==='source') {source=new Uint8ClampedArray(buffer);sampleKey='null';analysis=ColorEngine.analyze(source);postMessage({id,kind,analysis,width,height});return;}
    if(kind==='export') {
      const data=new Uint8ClampedArray(buffer),profile=analysis||ColorEngine.analyze(data,settings.sample),out=ColorEngine.render(data,settings,profile,false);
      // Encode losslessly off the UI thread. The native save path performs the
      // only JPEG encode, or keeps PNG pixels if the user chooses that format.
      const canvas=new OffscreenCanvas(width,height);canvas.getContext('2d').putImageData(new ImageData(out,width,height),0,0);
      const blob=await canvas.convertToBlob({type:'image/png'}),encoded=await blob.arrayBuffer();canvas.width=canvas.height=1;
      postMessage({id,kind,buffer:encoded,width,height,mime:'image/png'},[encoded]);return;
    }
    if(!source)throw new Error('Color preview is not ready');
    const key=JSON.stringify(settings.sample);
    if(key!==sampleKey){analysis=ColorEngine.analyze(source,settings.sample);sampleKey=key;}
    const out=ColorEngine.render(source,settings,analysis,mask);
    postMessage({id,kind,buffer:out.buffer,analysis},[out.buffer]);
  }catch(error){postMessage({id,error:String(error.message||error)});}
};
