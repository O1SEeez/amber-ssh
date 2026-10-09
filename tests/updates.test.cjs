const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createUpdates}=require('../electron/updates.cjs');
function fixture(options={}){
 const updater=new EventEmitter(),events=[],calls=[];
 updater.checkForUpdates=async()=>{calls.push('check');updater.emit('update-available',{version:'0.2.9'});};
 updater.downloadUpdate=async()=>{calls.push('download');updater.emit('download-progress',{percent:37});updater.emit('update-downloaded',{version:'0.2.9'});};
 updater.quitAndInstall=(...args)=>calls.push(['install',...args]);
 const updates=createUpdates({updater,enabled:true,version:'0.2.8',publish:s=>events.push(s),confirmRestart:async()=>true,beforeInstall:()=>calls.push('close-sessions'),t:s=>s,...options});
 return {updater,updates,events,calls};
}
test('portable/development builds never check, download or install in place',async()=>{
 const f=fixture({enabled:false});await f.updates.check();await f.updates.download();await f.updates.install();assert.equal(f.updates.get().phase,'unsupported');assert.deepEqual(f.calls,[]);
});
test('downloads and installation require explicit actions; quitting never auto-installs',async()=>{
 const f=fixture();assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.updater.allowDowngrade,false);assert.equal(f.updater.allowPrerelease,false);
 await f.updates.install();await f.updates.download();assert.deepEqual(f.calls,[]);
 await f.updates.check();assert.deepEqual(f.calls,['check']);assert.equal(f.updates.get().phase,'available');
 await f.updates.download();assert.deepEqual(f.calls,['check','download']);assert.equal(f.updates.get().phase,'ready');
 await f.updates.check();assert.equal(f.updates.get().phase,'ready');assert.equal(f.calls.length,2);
 await f.updates.install();assert.deepEqual(f.calls,['check','download','close-sessions',['install',true,true]]);
});
test('declining restart preserves SSH sessions and the ready update',async()=>{
 const f=fixture({confirmRestart:async()=>false});await f.updates.check();await f.updates.download();const result=await f.updates.install();assert.equal(result.canceled,true);assert.equal(f.updates.get().phase,'ready');assert.deepEqual(f.calls,['check','download']);
});
test('repeated clicks cannot spawn multiple downloads or restart confirmations',async()=>{
 let release,confirmCalls=0;const f=fixture({confirmRestart:()=>{confirmCalls++;return new Promise(r=>release=r);}});
 let finish;f.updater.checkForUpdates=()=>new Promise(r=>finish=()=>{f.updater.emit('update-available',{version:'0.2.9'});r();});
 const first=f.updates.check();await f.updates.check();assert.equal(f.updates.get().phase,'checking');finish();await first;await f.updates.download();
 const install=f.updates.install();await f.updates.install();assert.equal(confirmCalls,1);release(true);await install;assert.equal(f.calls.filter(c=>Array.isArray(c)).length,1);
});
test('network or checksum failures never install and a later retry can succeed',async()=>{
 const f=fixture();f.updater.checkForUpdates=async()=>{throw Error('offline');};await f.updates.check();assert.equal(f.updates.get().phase,'error');
 f.updater.checkForUpdates=async()=>f.updater.emit('update-available',{version:'0.2.9'});await f.updates.check();
 f.updater.downloadUpdate=async()=>{throw Error('sha512 mismatch');};await f.updates.download();await f.updates.install();assert.equal(f.updates.get().phase,'error');assert.deepEqual(f.calls,[]);
 await f.updates.check();f.updater.downloadUpdate=async()=>f.updater.emit('update-downloaded',{version:'0.2.9'});await f.updates.download();assert.equal(f.updates.get().phase,'ready');
});
test('an update error during restart confirmation prevents installation',async()=>{
 let release;const f=fixture({confirmRestart:()=>new Promise(r=>release=r)});await f.updates.check();await f.updates.download();const promise=f.updates.install();f.updater.emit('error',Error('changed file'));release(true);assert.equal((await promise).canceled,true);assert.deepEqual(f.calls,['check','download']);
});
