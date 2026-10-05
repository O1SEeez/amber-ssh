const test=require('node:test'),assert=require('node:assert/strict');
const {exportConnections,importConnections,mergeConnections,validateCommands,remoteName,remotePath,visibleBounds}=require('../electron/features.cjs');
const profile={id:'existing',name:'Test server',host:'example.invalid',port:22,username:'tester',auth:'key',keyPath:'C:/private/id_ed25519',remember:true,autoRoot:true,password:'secret-ciphertext',passphrase:'secret-key-ciphertext'};
test('export whitelists public connection settings and excludes secrets, key paths and trust',()=>{
  const result=exportConnections([profile]);assert.deepEqual(Object.keys(result.profiles[0]).sort(),['auth','host','name','port','username']);assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('private'));
});
test('import discards injected credentials, IDs, key paths, trust and automatic elevation',()=>{
  const [result]=importConnections({format:'amber-ssh-connections',version:1,profiles:[profile],hosts:{'example.invalid:22':'untrusted'}});assert.notEqual(result.id,profile.id);assert.equal(result.keyPath,'');assert.equal(result.remember,false);assert.equal(result.autoRoot,false);assert.equal(result.password,undefined);assert.equal(result.passphrase,undefined);
});
test('import validates the entire document before changes and skips duplicates',()=>{
  assert.throws(()=>importConnections({format:'amber-ssh-connections',version:1,profiles:[profile,{...profile,port:0}]}));assert.throws(()=>importConnections({profiles:[profile]}));const incoming=importConnections(exportConnections([profile,profile,{...profile,host:'another.invalid'}]));const merged=mergeConnections([profile],incoming);assert.equal(merged.added,1);assert.equal(merged.skipped,2);assert.equal(merged.profiles[0],profile);
});
test('saved commands reject terminal escape injection, empty commands and duplicate IDs',()=>{
  assert.throws(()=>validateCommands([{name:'Bad',command:'echo\x1b[31m'}]));assert.throws(()=>validateCommands([{name:'Empty',command:'  '}]));assert.throws(()=>validateCommands([{id:'same',name:'A',command:'ls'},{id:'same',name:'B',command:'pwd'}]));assert.equal(validateCommands([{name:'Logs',command:'pwd\r\nls'}])[0].command,'pwd\nls');
});
test('SFTP rejects malicious filenames and invalid paths before filesystem access',()=>{
  for(const name of ['..','../keys','folder/file','file\x00','file\\name'])assert.throws(()=>remoteName(name));assert.equal(remoteName('file with spaces.txt'),'file with spaces.txt');assert.throws(()=>remotePath('/home\x00/user'));assert.equal(remotePath('/home/tester'),'/home/tester');
});
test('restored window remains visible after a monitor is removed',()=>{
  const work={x:0,y:0,width:1920,height:1080};const result=visibleBounds({x:4000,y:-3000,width:1280,height:820},[work]);assert.ok(result.x>=0&&result.y>=0&&result.x+result.width<=work.width&&result.y+result.height<=work.height);
});
