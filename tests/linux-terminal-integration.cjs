// Run under xvfb after packaging. Uses real Bash/readline behind a local SSH server.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{Server}=require('ssh2');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const clients=new Set(),bridges=new Set(),sizes=[],input=[];
 const server=new Server({hostKeys:[crypto.generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'})]},client=>{
  clients.add(client);client.on('error',()=>{});client.on('authentication',ctx=>ctx.method==='password'?ctx.accept():ctx.reject());
  client.on('ready',()=>client.on('session',accept=>{
   const session=accept();let size={cols:80,rows:24},bridge;
   session.on('pty',(accept,reject,info)=>{size=info;sizes.push({...size});accept();});
   session.on('window-change',(accept,reject,info)=>{size=info;sizes.push({...size});bridge?.stdin.write(JSON.stringify({resize:[info.cols,info.rows]})+'\n');accept?.();});
   session.on('shell',accept=>{
    const channel=accept();channel.write('SERVER_METADATA_SENTINEL\r\n');
    bridge=spawn('python3',['-u',path.resolve('tests/bash-pty.py'),String(size.cols),String(size.rows)],{stdio:['pipe','pipe','inherit']});bridges.add(bridge);
    let pending='';bridge.stdout.on('data',data=>{pending+=data;let end;while((end=pending.indexOf('\n'))>=0){channel.write(Buffer.from(pending.slice(0,end),'base64'));pending=pending.slice(end+1);}});
    channel.on('data',data=>{input.push(data.toString());bridge.stdin.write(JSON.stringify({data:data.toString('base64')})+'\n');});channel.on('close',()=>bridge.stdin.end());
   });
  }));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'amber-terminal-ci-')),port=21000+Math.floor(Math.random()*1000);
 const child=spawn(path.resolve('release/linux-unpacked/amber-ssh'),['--remote-debugging-port='+port,'--password-store=gnome-libsecret'],{env:{...process.env,AMBER_TEST_DATA:profile},stdio:['ignore','pipe','pipe']});
 let logs='',socket;child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);
 try{
  let target;for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error(logs);try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');if(target)break;}catch{}await delay(200);}assert.ok(target,logs);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  let next=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
  async function call(method,params){const id=++next,m=await new Promise(r=>{pending.set(id,r);socket.send(JSON.stringify({id,method,params}));});if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m));return m.result;}
  async function evaluate(expression){return(await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;}
  async function wait(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression+'\n'+await evaluate('document.body.innerText'));}
  async function key(key,code,keyCode,modifiers=0){await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,modifiers});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,modifiers});}
  async function paste(text){assert.equal((await evaluate(`amber.copy(${JSON.stringify(text)})`)).ok,true);await key('v','KeyV',86,2);}
  await wait('!!window.amber&&!!document.querySelector("h1")');await evaluate("amber.language('en')");await call('Page.reload',{});await wait('!!document.querySelector("h1")');
  assert.equal((await evaluate(`amber.save({id:'',name:'Bash PTY test',host:'127.0.0.1',port:${server.address().port},username:'tester',auth:'password',keyPath:'',remember:false,autoRoot:false},{password:'ci-only',passphrase:''})`)).ok,true);
  await call('Page.reload',{});await wait('!!document.querySelector(".server-row")');await evaluate('document.querySelector(".server-row").click()');await wait('!!document.querySelector("[aria-modal=true]")');
  // Deliberately delay host approval until the terminal has been fitted.
  await delay(300);await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Trust and connect").click()');
  await wait('document.querySelector(".xterm-rows")?.textContent.includes("amber$")');await delay(150);
  assert.ok(sizes[0].cols!==110,'PTY must use the actual fitted width, not the old default');
  await evaluate('document.querySelector(".xterm-helper-textarea").focus()');
  const payload='a'.repeat(sizes.at(-1).cols*2+20)+'END_MARKER';
  const command=`printf 'RESULT:%s\\n' '${payload}'`;
  const before=input.length;await paste(command);
  // These arrows follow paste immediately, before waiting for remote output.
  await key('ArrowLeft','ArrowLeft',37);await key('ArrowLeft','ArrowLeft',37);await call('Input.insertText',{text:'X'});await key('Enter','Enter',13);
  const expected='RESULT:'+payload.slice(0,-1)+'X'+payload.slice(-1);
  await wait(`Array.from(document.querySelectorAll('.xterm-rows>div')).map(e=>e.textContent.trimEnd()).join('').includes(${JSON.stringify(expected)})`);
  const delivered=input.slice(before).join('');assert.ok(delivered.startsWith('\x1b[200~'+command+'\x1b[201~'),JSON.stringify(delivered));assert.ok(delivered.endsWith('\x1b[D\x1b[DX\r'),JSON.stringify(delivered));
  assert.ok((await evaluate('document.querySelector(".xterm-rows").textContent')).includes('SERVER_METADATA_SENTINEL'),'Wrapped editing must not overwrite the server banner');
  // A command with Cyrillic text must remain editable and execute once.
  await paste("printf 'CYRILLIC:%s\\n' 'привет мир'");await key('Enter','Enter',13);await wait('document.querySelector(".xterm-rows")?.textContent.includes("CYRILLIC:привет мир")');
  console.log('PASS: real packaged Linux client + SSH + Bash/readline, delayed handshake geometry, bracketed paste, wrapped command editing, immediate arrows, preserved server banner, Cyrillic input');
 }finally{
  socket?.close();child.kill();for(const c of clients)c.end();server.close();for(const b of bridges)b.stdin.end();await delay(500);for(const b of bridges)b.kill();
 }
}
if(process.platform==='linux')main().catch(e=>{console.error(e);process.exitCode=1;});
