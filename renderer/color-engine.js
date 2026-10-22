/* Shared, deterministic sRGB color processing for preview, export and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ColorEngine = api;
})(globalThis, () => {
  'use strict';
  const channels = ['master', 'red', 'green', 'blue', 'temperature', 'tint'];
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : lo));
  const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a)); return t*t*(3-2*t); };
  const isBalance = key => key === 'temperature' || key === 'tint';
  const identity = key => [{x:0,y:isBalance(key) ? .5 : 0},{x:1,y:isBalance(key) ? .5 : 1}];
  const defaults = () => ({curves:Object.fromEntries(channels.map(k=>[k,identity(k)])),temperature:0,tint:0,skin:0,sample:null});
  function points(values, key = 'master') {
    if (!Array.isArray(values)) return identity(key);
    const sorted = values.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:clamp(p.x),y:clamp(p.y)})).sort((a,b)=>a.x-b.x);
    const out=[]; for(const p of sorted) if(!out.length||p.x-out.at(-1).x>=1/255-1e-8) out.push(p);
    if(out.length<2)return identity(key);
    if(out[0].x>0)out.unshift({x:0,y:out[0].y});
    if(out.at(-1).x<1)out.push({x:1,y:out.at(-1).y});
    return out.length>16?[...out.slice(0,15),out.at(-1)]:out;
  }
  function normalize(s={}) {
    return {curves:Object.fromEntries(channels.map(k=>[k,points(s.curves?.[k],k)])),temperature:Number.isFinite(s.temperature)?clamp(s.temperature,-100,100):0,tint:Number.isFinite(s.tint)?clamp(s.tint,-100,100):0,skin:clamp(s.skin,0,100),sample:Array.isArray(s.sample)&&s.sample.length===3?s.sample.map(v=>clamp(v,0,255)):null};
  }
  // Shape-preserving cubic Hermite interpolation. Extrema remain inside the
  // neighboring controls, even with an intentionally descending segment.
  function curve(values, key='master', size=256) {
    const p=points(values,key),n=p.length,h=[],d=[],m=[];
    for(let i=0;i<n-1;i++){h[i]=p[i+1].x-p[i].x;d[i]=(p[i+1].y-p[i].y)/h[i];}
    m[0]=d[0];m[n-1]=d[n-2];
    for(let i=1;i<n-1;i++) {
      if(d[i-1]*d[i]<=0)m[i]=0;
      else {const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];m[i]=(a+b)/(a/d[i-1]+b/d[i]);}
    }
    const out=new Float32Array(size);let j=0;
    for(let i=0;i<size;i++) {const x=i/(size-1);while(j<n-2&&x>p[j+1].x)j++;const t=clamp((x-p[j].x)/h[j]),t2=t*t,t3=t2*t;out[i]=clamp((2*t3-3*t2+1)*p[j].y+(t3-2*t2+t)*h[j]*m[j]+(-2*t3+3*t2)*p[j+1].y+(t3-t2)*h[j]*m[j+1],Math.min(p[j].y,p[j+1].y),Math.max(p[j].y,p[j+1].y));}
    return out;
  }
  function hsv(r,g,b) {
    r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;
    const h=!d?0:hi===r?60*((g-b)/d%6):hi===g?60*((b-r)/d+2):60*((r-g)/d+4);
    return {h:(h+360)%360,s:hi?d/hi:0,v:hi};
  }
  const hueDistance = (a,b) => Math.abs(((a-b+540)%360)-180);
  function skinWeight(r,g,b,sample=null) {
    const y=(.2126*r+.7152*g+.0722*b)/255,hs=hsv(r,g,b);
    const light=smooth(.035,.12,y)*(1-smooth(.88,.99,y));
    if(sample) {const ref=hsv(...sample);return light*(1-smooth(10,30,hueDistance(hs.h,ref.h)))*(1-smooth(.12,.42,Math.abs(hs.s-ref.s)))*smooth(.025,.12,hs.s);}
    // Wide, soft chroma envelope includes light and dark skin. This is a color
    // range, not face recognition: warm wood/sand may also receive weight.
    const cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b;
    const chroma=(1-smooth(1,2.1,Math.hypot((cb-108)/24,(cr-151)/28)));
    return light*chroma*(1-smooth(24,48,hueDistance(hs.h,27)))*smooth(.035,.15,hs.s)*(1-smooth(.72,.97,hs.s));
  }
  function analyze(data,sample=null) {
    const histogram=Array.from({length:4},()=>new Array(256).fill(0)),skinHist=new Float64Array(256);
    let skinTotal=0,red=0,blue=0,total=0;
    const stride=Math.max(1,Math.ceil(data.length/4/160000));
    for(let i=0;i<data.length;i+=4*stride) {
      if(data[i+3]<128)continue;const r=data[i],g=data[i+1],b=data[i+2],y=Math.round(.2126*r+.7152*g+.0722*b);
      histogram[0][y]++;histogram[1][r]++;histogram[2][g]++;histogram[3][b]++;total++;
      const w=skinWeight(r,g,b,sample);skinTotal+=w;skinHist[y]+=w;red+=(r-g)*w;blue+=(g-b)*w;
    }
    let sum=0,median=.5;for(let i=0;i<256;i++){sum+=skinHist[i];if(sum>=skinTotal/2){median=i/255;break;}}
    const found=skinTotal>=Math.min(32,total*.025)&&skinTotal/Math.max(1,total)>.004;
    return {histogram,coverage:skinTotal/Math.max(1,total),found,median,lift:found?clamp(.016+(.65-median)*.09,.008,.05):0,redExcess:found?clamp(red/skinTotal/255-.1,0,.12):0,yellowExcess:found?clamp(blue/skinTotal/255-.12,0,.12):0};
  }
  function unchanged(input) {
    const s=normalize(input);return s.skin===0&&s.temperature===0&&s.tint===0&&channels.every(k=>s.curves[k].every(p=>Math.abs(p.y-(isBalance(k)?.5:p.x))<1e-8));
  }
  const linear = new Float32Array(256),encoded=new Float32Array(8193);
  for(let i=0;i<256;i++){const x=i/255;linear[i]=x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}
  for(let i=0;i<encoded.length;i++){const x=i/8192;encoded[i]=(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055)*255;}
  const enc=x=>encoded[Math.round(clamp(x)*8192)];
  function prepare(input,profile) {
    const s=normalize(input),lut=Object.fromEntries(channels.map(k=>[k,curve(s.curves[k],k)]));
    const rgb=['red','green','blue'].map(k=>Float32Array.from(lut[k],v=>lut.master[Math.round(v*255)]*255));
    const balance=Array.from({length:256},(_,i)=>{const temp=s.temperature/100+(lut.temperature[i]-.5)*2,tint=s.tint/100+(lut.tint[i]-.5)*2;return [Math.exp(temp*.22+tint*.08),Math.exp(-tint*.12),Math.exp(-temp*.22+tint*.08)];});
    return {s,rgb,balance,profile,wb:!!(s.temperature||s.tint||channels.slice(4).some(k=>s.curves[k].some(p=>p.y!==.5))),identity:unchanged(s)};
  }
  function render(data,input,profile,mask=false) {
    if(!(data instanceof Uint8ClampedArray)||data.length%4)throw new Error('Invalid RGBA image');
    const p=prepare(input,profile||analyze(data,input?.sample)),out=new Uint8ClampedArray(data.length),{s,rgb,balance}=p;
    if(p.identity&&!mask){out.set(data);return out;}
    for(let i=0;i<data.length;i+=4) {
      const r0=data[i],g0=data[i+1],b0=data[i+2],y0=(.2126*r0+.7152*g0+.0722*b0)/255;
      let r=rgb[0][r0],g=rgb[1][g0],b=rgb[2][b0];
      if(p.wb){const gains=balance[Math.round(y0*255)],lr=linear[Math.round(r)],lg=linear[Math.round(g)],lb=linear[Math.round(b)],y=.2126*lr+.7152*lg+.0722*lb,yn=.2126*lr*gains[0]+.7152*lg*gains[1]+.0722*lb*gains[2],scale=yn>0?y/yn:1;r=enc(lr*gains[0]*scale);g=enc(lg*gains[1]*scale);b=enc(lb*gains[2]*scale);}
      const weight=(mask||s.skin>0)?skinWeight(r0,g0,b0,s.sample):0;
      if(mask){const a=weight*.68;r=r*(1-a);g=g*(1-a)+210*a;b=b*(1-a)+205*a;}
      else if(s.skin>0&&p.profile.found&&weight>0) {
        const amount=s.skin/100*weight,y=(.2126*r+.7152*g+.0722*b)/255;
        // Gentle, image-adaptive midtone lift; highlights roll off. No blur,
        // resampling, skin smoothing or neighborhood averaging is applied.
        const lift=p.profile.lift*4*y*(1-y)*(1-smooth(.72,.97,y))*amount;
        const saturation=1-.035*amount,scale=y>.001?(y+lift)/y:1,gray=y*255;
        r=(gray+(r-gray)*saturation)*scale-p.profile.redExcess*255*.18*amount;
        g=(gray+(g-gray)*saturation)*scale;
        b=(gray+(b-gray)*saturation)*scale+p.profile.yellowExcess*255*.12*amount;
      }
      out[i]=r;out[i+1]=g;out[i+2]=b;out[i+3]=data[i+3];
    }
    return out;
  }
  return {channels,isBalance,identity,defaults,normalize,curve,hsv,skinWeight,analyze,unchanged,render};
});
