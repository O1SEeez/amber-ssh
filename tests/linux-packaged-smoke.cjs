// CI-only: exercises the real Linux binary in an isolated profile via Chromium CDP.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
async function main(){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'amber-linux-smoke-'));
  const port=19000+Math.floor(Math.random()*1000);
  const child=spawn(path.resolve('release/linux-unpacked/amber-ssh'),['--remote-debugging-port='+port,'--password-store=gnome-libsecret'],{env:{...process.env,AMBER_TEST_DATA:profile},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);
  let socket;
  try{
    let target;
    for(let i=0;i<150;i++){
      if(child.exitCode!==null)throw new Error('Linux app exited: '+logs);
      try{target=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(page=>page.type==='page');if(target)break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert.ok(target,'No renderer: '+logs);
    socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let nextId=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
    async function evaluate(expression){const id=++nextId;const response=await new Promise(resolve=>{pending.set(id,resolve);socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});if(response.error||response.result?.exceptionDetails)throw new Error(JSON.stringify(response));return response.result.result.value;}
    for(let i=0;i<100;i++){if(await evaluate('!!window.amber && !!document.querySelector("button")'))break;await new Promise(resolve=>setTimeout(resolve,100));}
    const result=await evaluate(`(async()=>{
      const profiles=await amber.profiles();const settings=await amber.settings();
      const copied=await amber.copy('Linux clipboard');const pasted=await amber.clipboardText();
      const language=await amber.language('en');
      const saved=await amber.save({id:'linux-ci',name:'CI only',host:'127.0.0.1',port:22,username:'test',auth:'password',remember:true,autoRoot:false},{password:'ci-only-not-a-real-secret',passphrase:''});
      return {profiles,settings,copied,pasted,language,saved,text:document.body.innerText};
    })()`);
    assert.equal(result.profiles.ok,true);assert.deepEqual(result.profiles.value,[]);assert.equal(result.settings.ok,true);assert.equal(result.copied.ok,true);assert.equal(result.pasted.value,'Linux clipboard');assert.equal(result.language.ok,true);assert.equal(result.saved.ok,true,JSON.stringify(result.saved));
    const stored=JSON.parse(fs.readFileSync(path.join(profile,'connections.json'),'utf8'));assert.ok(stored.profiles[0].password);assert.ok(!JSON.stringify(stored).includes('ci-only-not-a-real-secret'));
    const remembered=await evaluate('amber.profiles()');assert.equal(remembered.value[0].hasPassword,true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'settings.json'),'utf8')).language,'en');
    console.log('PASS: packaged Linux ELF, renderer, secure IPC, clipboard, saved language, GNOME Keyring encryption and profile persistence');
  }finally{socket?.close();if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();setTimeout(()=>{child.kill('SIGKILL');resolve();},3000).unref();});fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
}
if(process.platform==='linux')main().catch(error=>{console.error(error);process.exitCode=1;});
