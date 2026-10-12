'use strict';
function languageDefaults(saved,existing){
  const language=['en','zh-CN'].includes(saved?.language)?saved.language:existing?'zh-CN':'en';
  const languageChosen=typeof saved?.languageChosen==='boolean'?saved.languageChosen:existing;
  return {language,languageChosen};
}
function languagePatch(patch){
  const result={};
  if(Object.hasOwn(patch,'language')){if(!['en','zh-CN'].includes(patch.language))throw new Error('无效的界面语言');result.language=patch.language;}
  if(Object.hasOwn(patch,'languageChosen')){if(typeof patch.languageChosen!=='boolean')throw new Error('无效的语言选择状态');result.languageChosen=patch.languageChosen;}
  return result;
}
module.exports={languageDefaults,languagePatch};
