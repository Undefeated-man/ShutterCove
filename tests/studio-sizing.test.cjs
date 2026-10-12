'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Obtain the real internal canvas limiter without introducing a production
// testing API or drawing hundreds of MB solely to test integer dimensions.
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/studio.js'),'utf8').replace('window.Studio={edit,collage};','window.__fitSize=fitSize;'),{window});
for(const [width,height] of [[3000,16002],[2560,18752],[300000,100],[1,80000]]){
  test('Collage canvas remains within physical limits for '+width+' x '+height,()=>{
    const [w,h]=window.__fitSize(width,height);
    assert.ok(Number.isInteger(w)&&Number.isInteger(h)&&w>=1&&h>=1);
    assert.ok(w<=24000&&h<=24000);
    assert.ok(w*h<=48000000,'actual integer dimensions must satisfy the save limit');
  });
}
