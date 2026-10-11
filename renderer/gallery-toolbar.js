'use strict';
(() => {
  const app=window.App,scroll=document.getElementById('main-scroll'),toolbar=document.getElementById('gallery-toolbar');
  if(!app||!scroll||!toolbar)return;
  let height=0,frame=0;
  app.galleryInset=()=>Math.ceil(height||toolbar.getBoundingClientRect().height)+12;
  function measure(){scroll.style.setProperty('--gallery-scroll-pad',getComputedStyle(scroll).paddingTop);height=toolbar.getBoundingClientRect().height;scroll.style.setProperty('--gallery-toolbar-inset',app.galleryInset()+'px');window.PhotoTimeline?.refresh();}
  function update(){frame=0;const stuck=toolbar.getBoundingClientRect().top<=scroll.getBoundingClientRect().top+1&&scroll.scrollTop>0;toolbar.classList.toggle('is-stuck',stuck);}
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  new ResizeObserver(()=>{measure();schedule();}).observe(toolbar);
  scroll.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
  measure();update();
})();
