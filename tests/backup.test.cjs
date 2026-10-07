const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {encryptBackup,decryptBackup}=require('../electron/backup.cjs');
const {registerBackups}=require('../electron/backup-ipc.cjs');
const password='a long unique test password';
const profile={id:'source',name:'Demo',host:'demo.invalid',port:22,username:'tester',auth:'password',remember:true,autoRoot:true,password:'ssh-test-password',passphrase:'key-test-passphrase',keyPath:'private-file',hosts:{unsafe:'trust'}};
test('encrypted backup round-trips secrets, hides metadata and strips trust, IDs, key paths and elevation',async()=>{
  const first=await encryptBackup([profile],password),second=await encryptBackup([profile],password);
  assert.notEqual(first.data,second.data);assert.notEqual(first.salt,second.salt);assert.notEqual(first.iv,second.iv);
  for(const secret of ['ssh-test-password','key-test-passphrase','demo.invalid','tester','Demo','private-file'])assert.ok(!JSON.stringify(first).includes(secret));
  const [restored]=await decryptBackup(first,password);
  assert.equal(restored.password,profile.password);assert.equal(restored.passphrase,profile.passphrase);
  assert.notEqual(restored.id,'source');assert.equal(restored.keyPath,'');assert.equal(restored.autoRoot,false);assert.equal(restored.hosts,undefined);
});
test('wrong passwords and tampering are rejected; attacker-controlled KDF settings are not accepted',async()=>{
  const file=await encryptBackup([profile],password);
  await assert.rejects(decryptBackup(file,'wrong password'),/Неверный пароль/);
  for(const field of ['salt','iv','tag','data']){
    const bytes=Buffer.from(file[field],'base64');bytes[0]^=1;
    await assert.rejects(decryptBackup({...file,[field]:bytes.toString('base64')},password),/Неверный пароль/);
  }
  await assert.rejects(decryptBackup({...file,kdf:'scrypt-unlimited'},password));
  await assert.rejects(decryptBackup({...file,version:2},password));
  await assert.rejects(decryptBackup({...file,salt:'AAAA'},password));
  await assert.rejects(encryptBackup([profile],'short'));
});
function harness(directory,profiles=[],failStorage=false){
  const handlers=new Map(),db={profiles,hosts:{}},file=path.join(directory,'connections.json'),exportFile=path.join(directory,'backup.amber');let selected=exportFile,canceled=false;
  const encrypt=secret=>{if(failStorage)throw new Error('Keyring unavailable');return 'target-encrypted:'+secret;};
  const decrypt=value=>value?value.replace(/^source-encrypted:/,''):'';
  registerBackups({wrap:(name,handler)=>handlers.set(name,handler),dialog:{showSaveDialog:async()=>({canceled,filePath:exportFile}),showOpenDialog:async()=>({canceled,filePaths:[selected]})},win:{once:()=>{}},db,persist:()=>fs.writeFileSync(file,JSON.stringify(db)),encrypt,decrypt,storePath:file,settingsPath:path.join(directory,'settings.json'),t:x=>x});
  return {db,exportFile,file,call:(name,...args)=>handlers.get('profiles:'+name)(...args),select:filename=>selected=filename,cancel:()=>canceled=true};
}
test('IPC transfer exports only persisted secrets and imports atomically, re-encrypting for target storage and keeping duplicates intact',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'amber-backup-test-'));
  try{
    fs.mkdirSync(path.join(dir,'source'));fs.mkdirSync(path.join(dir,'target'));
    const source=harness(path.join(dir,'source'),[{...profile,password:'source-encrypted:'+profile.password,passphrase:''},{...profile,id:'temporary',host:'temporary.invalid',remember:false,password:'must-not-export'}]);
    await source.call('export',{encrypted:true,password});
    const raw=JSON.parse(fs.readFileSync(source.exportFile));const decrypted=await decryptBackup(raw,password);assert.equal(decrypted[1].password,'');
    const target=harness(path.join(dir,'target'));target.select(source.exportFile);
    let preview=await target.call('import-preview');assert.equal(preview.locked,true);assert.equal(preview.names,undefined);
    await assert.rejects(target.call('import-unlock',preview.token,'wrong password'));assert.equal(target.db.profiles.length,0);
    const stale=preview.token;preview=await target.call('import-unlock',preview.token,password);assert.equal(preview.added,2);assert.ok(!JSON.stringify(preview).includes(profile.password));
    await assert.rejects(target.call('import-apply',stale,true));
    await target.call('import-apply',preview.token,false);assert.equal(target.db.profiles.length,0);assert.ok(!fs.existsSync(target.file));
    preview=await target.call('import-preview');preview=await target.call('import-unlock',preview.token,password);await target.call('import-apply',preview.token,true);
    assert.equal(target.db.profiles[0].password,'target-encrypted:'+profile.password);assert.equal(target.db.profiles[0].remember,true);assert.equal(target.db.profiles[1].remember,false);assert.equal(target.db.profiles[0].autoRoot,false);assert.deepEqual(target.db.hosts,{});
    const existing=target.db.profiles[0];preview=await target.call('import-preview');preview=await target.call('import-unlock',preview.token,password);assert.equal(preview.skipped,2);await target.call('import-apply',preview.token,true);assert.equal(target.db.profiles[0],existing);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unavailable target keyring leaves existing database unchanged; plain imports cannot inject secrets',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'amber-backup-test-'));
  try{
    const filename=path.join(dir,'input.amber');fs.writeFileSync(filename,JSON.stringify(await encryptBackup([profile],password)));
    const target=harness(dir,[],true);target.select(filename);let p=await target.call('import-preview');p=await target.call('import-unlock',p.token,password);
    await assert.rejects(target.call('import-apply',p.token,true),/Keyring unavailable/);assert.deepEqual(target.db.profiles,[]);assert.ok(!fs.existsSync(target.file));
    fs.writeFileSync(filename,JSON.stringify({format:'amber-ssh-connections',version:1,profiles:[profile]}));p=await target.call('import-preview');await target.call('import-apply',p.token,true);assert.equal(target.db.profiles[0].password,undefined);assert.equal(target.db.profiles[0].remember,false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
