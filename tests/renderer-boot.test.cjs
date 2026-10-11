'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject}; };

/* Execute the actual renderer startup with synthetic DOM primitives. The photo
 * scan deliberately never finishes; no filesystem or photo API is available. */
function boot({getSettings,scan,missingElement,bridge=true}={}) {
  const nodes=new Map(),errors=[],style=new Map();
  const node = id => {
    if(id===missingElement)return null;
    if(!nodes.has(id))nodes.set(id,{id,style:{},hidden:false,value:'',listeners:new Map(),children:[],addEventListener(type,fn){this.listeners.set(type,fn);},querySelectorAll(){return[];},append(child){this.children.push(child);},remove(){}});
    return nodes.get(id);
  };
  let settingsReads=0,scanReads=0;
  const api={getSettings:()=>{settingsReads++;return getSettings();},scan:root=>{scanReads++;return scan(root);},onProgress:()=>()=>{}};
  const window={timeMachine:bridge?api:undefined};
  const document={getElementById:node,documentElement:{style:{setProperty(key,value){style.set(key,value);}}},createElement:()=>node(`created-${nodes.size}`),addEventListener(){},dispatchEvent(){}};
  const context=vm.createContext({window,document,location:{search:''},URLSearchParams,setTimeout:()=>0,console:{error:error=>errors.push(error)}});
  let startupError;
  try{vm.runInContext(source,context,{filename:'renderer/app.js'});}catch(error){startupError=error;}
  return{window,nodes,style,errors,startupError,reads:()=>({settings:settingsReads,scan:scanReads})};
}

test('renderer readiness waits for real settings IPC while controls bind first',async()=>{
  const settings=deferred(),scan=deferred();
  const app=boot({getSettings:()=>settings.promise,scan:()=>scan.promise});
  assert.equal(app.startupError,undefined);
  assert.equal(app.window.__shiguangBootReady,false);
  assert.equal(typeof app.nodes.get('search').listeners.get('input'),'function');
  assert.deepEqual(app.reads(),{settings:1,scan:0});
  settings.resolve({fontScale:1.2,libraryRoot:'/synthetic-readiness'});await tick();
  assert.equal(app.window.__shiguangBootReady,true);
  assert.deepEqual(app.reads(),{settings:1,scan:1});
  assert.equal(app.window.App.state.scanning,true);
  assert.equal(app.window.App.state.settingsReady,false);
  assert.equal(app.style.get('--font-scale'),'1.2');
});

test('settings IPC failure cannot acknowledge an unusable startup',async()=>{
  const settings=deferred();const app=boot({getSettings:()=>settings.promise,scan:()=>{throw new Error('Unexpected scan');}});
  settings.reject(new Error('Synthetic settings read failure'));await tick();
  assert.equal(app.window.__shiguangBootReady,false);
  assert.equal(app.window.App.state.settingsReady,false);
  assert.deepEqual(app.reads(),{settings:1,scan:0});
  assert.equal(app.errors.length,1);
});

test('binding failure leaves readiness false even when a settings bridge exists',()=>{
  const app=boot({missingElement:'search',getSettings:async()=>({}),scan:async()=>({photos:[]})});
  assert.ok(app.startupError);
  assert.equal(app.window.__shiguangBootReady,false);
  assert.deepEqual(app.reads(),{settings:0,scan:0});
});

test('a missing application bridge cannot become ready',()=>{
  const app=boot({bridge:false});
  assert.equal(app.startupError,undefined);
  assert.equal(app.window.__shiguangBootReady,false);
  assert.deepEqual(app.reads(),{settings:0,scan:0});
});

test('later gallery scan failure does not invalidate successful basic startup',async()=>{
  const scan=deferred();const app=boot({getSettings:async()=>({fontScale:1.5,libraryRoot:'/synthetic-readiness'}),scan:()=>scan.promise});
  await tick();assert.equal(app.window.__shiguangBootReady,true);
  scan.reject(new Error('Synthetic slow external library failure'));await tick();
  assert.equal(app.window.__shiguangBootReady,true);
  assert.equal(app.window.App.state.scanning,false);
  assert.equal(app.errors.length,1);
});
