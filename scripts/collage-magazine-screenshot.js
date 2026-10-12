/* New generated landscapes in mixed ratios; no private photos or crops. */
(async()=>{
  for(let i=0;i<600&&(!window.App?.api.isDemo||!App.state.photos.length||App.state.scanning);i++)await new Promise(r=>setTimeout(r,20));
  if(!App.api.isDemo)throw new Error('Synthetic demo required');
  const sizes=[[1400,800],[800,1200],[1000,1000],[1600,900]],names=['湖泊来信','山间薄雾','日落拾光','旷野之风'];
  const sources=new Map(),photos=sizes.map(([w,h],i)=>({id:'magazine-demo-'+i,name:names[i]+'.JPG',jpegPath:'/synthetic-demo/'+i+'.JPG',rawPath:null,width:w,height:h}));
  for(let i=0;i<sizes.length;i++){
    const [w,h]=sizes[i],palettes=[['#bbd7d6','#e9e2c8','#537e80','#9aa88c'],['#c7d5d1','#ece8d5','#4d7273','#8b9f87'],['#c9d8d7','#f0d7a3','#668381','#b6a376'],['#aacbd3','#dfdec2','#607f78','#a4ad86']],p=palettes[i];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="${p[2]}"/><stop offset="1" stop-color="#bdd2bd"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#sky)"/><circle cx="${w*.74}" cy="${h*.24}" r="${Math.min(w,h)*.08}" fill="#fff9df" opacity=".86"/><path d="M0 ${h*.56} L${w*.18} ${h*.31} L${w*.31} ${h*.48} L${w*.52} ${h*.24} L${w*.73} ${h*.47} L${w*.85} ${h*.37} L${w} ${h*.55} V${h} H0Z" fill="${p[3]}"/><path d="M0 ${h*.67} L${w*.22} ${h*.46} L${w*.43} ${h*.61} L${w*.63} ${h*.41} L${w*.82} ${h*.56} L${w} ${h*.46} V${h} H0Z" fill="${p[2]}"/><path d="M0 ${h*.75} Q${w*.3} ${h*.63} ${w*.57} ${h*.73} T${w} ${h*.69} V${h} H0Z" fill="url(#water)"/>${Array.from({length:14},(_,j)=>`<path d="M${w*.06} ${h*(.78+j*.011)} Q${w*.35} ${h*(.77+j*.011)} ${w*.92} ${h*(.79+j*.011)}" fill="none" stroke="#eef4dc" stroke-width="${Math.min(w,h)*.0018}" opacity="${.24-j*.009}"/>`).join('')}</svg>`;
    sources.set(photos[i].id,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
  }
  App.api.source=async({id})=>sources.get(id);App.api.thumbnail=async({id})=>sources.get(id);
  await Studio.collage(photos);
  const change=(id,value,type='change')=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event(type,{bubbles:true}));};
  change('collage-template','magazine');change('collage-title','沿着光，收藏四季','input');change('collage-title-size','155');
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return{syntheticOnly:true,template:'magazine',photos:4,originalRatios:sizes.map(([w,h])=>w/h),title:'沿着光，收藏四季',width:document.getElementById('collage-canvas').width,height:document.getElementById('collage-canvas').height};
})();
