'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {nativeMessage,localizedDialog}=require('../app/ui-language.cjs');
test('native dialog specificity keeps editor names and translates whole prompt',()=>{
  assert.equal(nativeMessage('选择 Photoshop 应用','en'),'Choose Photoshop application');
  assert.equal(nativeMessage('选择 Lightroom 应用','en'),'Choose Lightroom application');
  assert.equal(nativeMessage('选择 Photoshop 应用','zh-CN'),'选择 Photoshop 应用');
});
test('native dialogs translate chrome while preserving filenames paths extensions and counts',async()=>{
  const original={title:'保存新的照片',defaultPath:'/synthetic/中文/相册设置.jpg',filters:[{name:'JPEG 照片',extensions:['jpg']}],buttons:['取消','覆盖'],message:'将 2 组照片、共 3 个原文件移到废纸篓？'};
  const result=await localizedDialog({showSaveDialog:async(_window,options)=>options},'showSaveDialog',{},'en',original);
  assert.equal(result.title,'Save new photo');assert.equal(result.defaultPath,original.defaultPath);assert.deepEqual(result.filters,[{name:'JPEG photo',extensions:['jpg']}]);assert.deepEqual(result.buttons,['Cancel','Overwrite']);assert.equal(result.message,'Move 2 photo groups (3 original files) to the Trash?');assert.equal(original.title,'保存新的照片');
});
