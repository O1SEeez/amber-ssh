const test=require('node:test');const assert=require('node:assert/strict');const {validateProfile,rootCommand,fingerprint,isSudoPrompt,createOutputFilter}=require('../electron/security.cjs');
test('reject malformed addresses and ports before SSH connection',()=>{
  const valid={name:'VM',host:'192.0.2.1',username:'alex',port:22,auth:'password'};
  assert.equal(validateProfile(valid).port,22);
  for(const port of [0,65536,22.5,NaN])assert.throws(()=>validateProfile({...valid,port}));
  assert.throws(()=>validateProfile({...valid,host:'host\ncommand'}));
  assert.throws(()=>validateProfile({...valid,auth:'key'}));
});
test('internal sudo marker stays out of display across any chunk boundary',()=>{
  const marker='[amber:'+ 'a'.repeat(32)+']',command=rootCommand('a'.repeat(32)).trim();
  const text='user:~$ '+command+'\r\n'+marker;
  for(let split=1;split<text.length;split++){
    const filter=createOutputFilter([[command,'sudo -i'],[marker,'[sudo] password: ']]);
    assert.equal(filter.push(text.slice(0,split))+filter.push(text.slice(split))+filter.flush(),'user:~$ sudo -i\r\n[sudo] password: ');
  }
});
test('sudo command contains only generated marker and never a password',()=>{
  const command=rootCommand('a'.repeat(32));assert.match(command,/^sudo -p '\[amber:a{32}\]' -i\r$/);
  assert.throws(()=>rootCommand("'; touch /tmp/unwanted; '"));
});
test('fingerprint has standard SHA256 format',()=>{assert.equal(fingerprint(Buffer.from('hello')),'SHA256:LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ');});
test('sudo autofill ignores echoed command even when its output is split at marker',()=>{
  const marker='[amber:'+ 'a'.repeat(32)+']';
  assert.equal(isSudoPrompt("user@vm:~$ sudo -p '"+marker,marker),false);
  assert.equal(isSudoPrompt('Some program says '+marker,marker),false);
  assert.equal(isSudoPrompt("user@vm:~$ sudo -p '"+marker+"' -i\r\n"+marker,marker),true);
});
