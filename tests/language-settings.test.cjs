'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {languageDefaults,languagePatch}=require('../app/language-settings.cjs');
test('fresh installation starts in English and requires a choice',()=>assert.deepEqual(languageDefaults({},false),{language:'en',languageChosen:false}));
test('existing profiles retain Chinese without repeating a first-run choice',()=>assert.deepEqual(languageDefaults({libraryRoot:'example'},true),{language:'zh-CN',languageChosen:true}));
test('chosen language survives restarts and unrelated patches do not change it',()=>{assert.deepEqual(languageDefaults({language:'en',languageChosen:true},true),{language:'en',languageChosen:true});assert.deepEqual(languagePatch({fontScale:1.2}),{});});
test('invalid locale or choice payload cannot be persisted',()=>{assert.throws(()=>languagePatch({language:'ja'}));assert.throws(()=>languagePatch({languageChosen:'yes'}));});
