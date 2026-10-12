'use strict';
const catalogs=Object.assign({},...['core','gallery','studios','widgets'].map(name=>require(`../renderer/locales/${name}.json`)));
Object.assign(catalogs,{
  '编辑':'Edit','窗口':'Window','应用':'Application','选择照片文件夹':'Choose photo folder',
  '选择 {editor} 应用':'Choose {editor} application','保存 GIF 动图':'Save animated GIF','GIF 动图':'Animated GIF',
  '保存新的照片':'Save new photo','JPEG 分享成品':'JPEG share image','JPEG 照片':'JPEG photo','PNG 图片':'PNG image',
  '将 {photos} 组照片、共 {files} 个原文件移到废纸篓？':'Move {photos} photo groups ({files} original files) to the Trash?',
  '包含选中的 JPEG 和 CR3。可以从系统废纸篓恢复。':'Includes the selected JPEG and CR3 files. You can recover them from the system Trash.',
  '覆盖原 JPEG？':'Overwrite the original JPEG?','覆盖':'Overwrite',
  '此操作会替换原文件，画布导出的照片不保留原 EXIF。建议另存为。':'This replaces the original file. Canvas exports do not retain the original EXIF metadata. Save a copy to keep the original.',
  '无效的界面语言':'Invalid interface language','无效的语言选择状态':'Invalid language selection state',
  '请选择有效的字体大小':'Choose a valid font size','未经授权的请求':'Unauthorized request',
  '正在更新，请等待应用重新打开':'Updating. Please wait for the application to reopen.'
});
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(catalogs).filter(([key])=>/\{[A-Za-z]/.test(key)).sort(([a],[b])=>b.replace(/\{[^}]*\}/g,'').length-a.replace(/\{[^}]*\}/g,'').length).map(([key,value])=>({value,keys:[...key.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(m=>m[1]),pattern:new RegExp('^'+key.split(/(\{[A-Za-z][A-Za-z0-9_]*\})/).map(part=>/^\{/.test(part)?'([\\s\\S]*?)':escape(part)).join('')+'$')}));
function nativeMessage(value,language){if(language!=='en'||typeof value!=='string')return value;if(Object.hasOwn(catalogs,value))return catalogs[value];for(const item of templates){const match=value.match(item.pattern);if(match){const args=Object.fromEntries(item.keys.map((key,index)=>[key,match[index+1]]));return item.value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(all,key)=>args[key]??all);}}return value;}
function localizedDialog(dialog,method,win,language,options){const localized={...options};for(const key of ['title','message','detail','buttonLabel'])if(typeof localized[key]==='string')localized[key]=nativeMessage(localized[key],language);if(localized.buttons)localized.buttons=localized.buttons.map(value=>nativeMessage(value,language));if(localized.filters)localized.filters=localized.filters.map(filter=>({...filter,name:nativeMessage(filter.name,language)}));return dialog[method](win,localized);}
module.exports={nativeMessage,localizedDialog};
