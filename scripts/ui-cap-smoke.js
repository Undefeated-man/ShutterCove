(async () => {
  const wait = async fn => { for (let i = 0; i < 500; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 40)); } throw Error('Cap test timed out'); };
  await wait(() => App?.state.photos.length === 16);
  const photo = App.state.photos[0];
  // A small solid fixture makes the cap test deterministic and cheap to decode.
  const uri = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#d93423"/></svg>');
  App.api.source = async () => uri;
  App.api.thumbnail = async () => uri;
  let saved;
  App.api.saveImage = async args => { saved = args; return { canceled: false, path: 'synthetic-cap.jpg' }; };
  await Studio.collage(Array.from({ length: 30 }, () => photo));
  const type = document.getElementById('collage-template'); type.value = 'vertical'; type.dispatchEvent(new Event('change'));
  document.getElementById('collage-export').click();
  await wait(() => saved && !document.getElementById('collage-canvas'));
  const image = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = saved.dataUrl; });
  if (image.width > 24000 || image.height > 24000 || image.width * image.height > 48000000) throw Error('Collage exceeded resource limits');
  const c = document.createElement('canvas'); c.width = 1; c.height = 1;
  const ctx = c.getContext('2d'); ctx.drawImage(image, image.width * .5, image.height * .9, 1, 1, 0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  if (!(pixel[0] > 130 && pixel[1] < 110)) throw Error('Capped collage content was scaled twice');
  return { passed: 2, checks: ['Long collage obeys dimensions and pixel cap', 'Capped export draws originals once at the correct scale'], dimensions: [image.width, image.height] };
})();
