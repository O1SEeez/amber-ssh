const {t,setLanguage}=require('./localization.cjs');
const {app,BrowserWindow,ipcMain,dialog,safeStorage,screen,clipboard,shell} = require('electron');
const {Client} = require('ssh2');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const {StringDecoder} = require('node:string_decoder');
const {validateProfile,rootCommand,fingerprint,isSudoPrompt,createOutputFilter} = require('./security.cjs');
const {Confirmations}=require('./confirmations.cjs');
const {validateCommands,visibleBounds}=require('./features.cjs');
const {registerSftp}=require('./sftp.cjs');
const {createTerminalSize}=require('./terminal-size.cjs');
const {createUpdates}=require('./updates.cjs');
let win, db, storePath;
const confirmations=new Confirmations(event=>{if(win&&!win.isDestroyed())win.webContents.send('ssh:event',event);});
const sessions=new Map();
const tabOwners=new Map();
const sessionSecrets=new Map();
if(process.env.AMBER_TEST_DATA)app.setPath('userData',process.env.AMBER_TEST_DATA);
function persist(){ const temp=storePath+'.tmp'; fs.writeFileSync(temp,JSON.stringify(db,null,2),{mode:0o600}); fs.renameSync(temp,storePath); }
const {encrypt,decrypt}=require('./secret-storage.cjs').createSecretStorage(safeStorage,process.platform,t);
function publicProfile(p){ const {password,passphrase,...rest}=p; return {...rest,hasPassword:!!password || !!sessionSecrets.get(p.id)?.password,hasPassphrase:!!passphrase || !!sessionSecrets.get(p.id)?.passphrase}; }
function emit(s,type,extra={}){ if(sessions.get(s.id)===s&&win&&!win.isDestroyed()) win.webContents.send('ssh:event',{id:s.id,type,...extra}); }
function clearOutputFilter(s){if(s.outputFilter){const data=s.outputFilter.flush();if(data)emit(s,'data',{data});s.outputFilter=null;}}
function authorized(e){ if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame) throw new Error('Forbidden'); }
function wrap(channel,handler){ ipcMain.handle(channel,async(e,...args)=>{ authorized(e); try {return {ok:true,value:await handler(...args)};}catch(error){return {ok:false,error:t(error.message)};} }); }
function finish(s){ if(s.closed)return; clearOutputFilter(s); s.transfer?.abort(); s.closed=true; confirmations.cancelSession(s.id); clearTimeout(s.handshakeTimer); clearInterval(s.timer); clearInterval(s.probeTimer); clearTimeout(s.rootTimer); s.probeSocket?.destroy(); s.password=''; s.client.end(); emit(s,'status',{status:'disconnected'}); sessions.delete(s.id); }
function armHandshake(s){clearTimeout(s.handshakeTimer);s.handshakeTimer=setTimeout(()=>{emit(s,'status',{status:'error',message:t("Сервер не ответил за 20 секунд")});finish(s);},20000);}
function elevate(s){
  if(!s.channel||s.closed)throw new Error(t("Сессия не подключена"));
  if(s.rootPending)throw new Error(t("Переход уже запущен"));
  if(!s.password)throw new Error(t("Для sudo сохраните пароль пользователя в настройках подключения"));
  const token=crypto.randomBytes(16).toString('hex'); s.rootMarker=`[amber:${token}]`; s.rootPending=true; s.rootSent=false; s.rootBuffer='';
  if(s.outputFilter)emit(s,'data',{data:s.outputFilter.flush()});
  s.outputFilter=createOutputFilter([[rootCommand(token).trim(),'sudo -i'],[s.rootMarker,`[sudo] password for ${s.username}: `]]);
  s.rootTimer=setTimeout(()=>{s.rootPending=false;s.rootBuffer='';clearOutputFilter(s);emit(s,'notice',{message:t("Автоввод sudo завершён. Если сервер требует дополнительные данные, продолжите вручную.")});},12000);
  s.channel.write(rootCommand(token));
}
function acceptOutput(s,data){
  if(s.closed||sessions.get(s.id)!==s)return;
  s.rx+=data.length;
  const text=s.decoder.write(data); const displayed=s.outputFilter?s.outputFilter.push(text):text; if(displayed)emit(s,'data',{data:displayed});
  if(!s.rootPending)return;
  s.rootBuffer=(s.rootBuffer+text).slice(-4096);
  // Require marker at end: an echoed sudo command contains the marker followed by quotes/options.
  if(isSudoPrompt(s.rootBuffer,s.rootMarker)){
    s.rootSent=true; s.rootPending=false; clearTimeout(s.rootTimer); clearOutputFilter(s); s.rootBuffer=''; s.channel.write(s.password+'\n'); s.tx+=Buffer.byteLength(s.password)+1;
    emit(s,'notice',{message:t("Сохранённый пароль передан sudo.")});
  }
}
function probe(s,p){
  if(s.closed)return;
  const started=performance.now();const socket=net.createConnection({host:p.host,port:p.port});
  s.probeSocket=socket;
  socket.setTimeout(3000);socket.once('connect',()=>{s.latency=Math.round(performance.now()-started);socket.destroy();});
  socket.once('error',()=>{s.latency=null;socket.destroy();});socket.once('timeout',()=>{s.latency=null;socket.destroy();});
}
app.whenReady().then(()=>{
  storePath=path.join(app.getPath('userData'),'connections.json');
  db={profiles:[],hosts:{}};
  if(fs.existsSync(storePath)){try {db=JSON.parse(fs.readFileSync(storePath,'utf8'));if(!Array.isArray(db.profiles)||!db.hosts)throw new Error('Invalid database');}catch{dialog.showErrorBox('Amber SSH',t("Не удалось прочитать connections.json. Файл сохранён без изменений."));app.quit();return;}}
  const settingsPath=path.join(app.getPath('userData'),'settings.json');let settings={fontSize:14,commands:[],language:'ru'};
  if(fs.existsSync(settingsPath)){try{const saved=JSON.parse(fs.readFileSync(settingsPath,'utf8'));settings={fontSize:Number.isInteger(saved.fontSize)&&saved.fontSize>=10&&saved.fontSize<=26?saved.fontSize:14,commands:validateCommands(saved.commands||[]),window:saved.window,language:saved.language==='en'?'en':'ru'};}catch{dialog.showErrorBox('Amber SSH',t("Не удалось прочитать settings.json. Файл сохранён без изменений."));app.quit();return;}}
  setLanguage(settings.language);
  function saveSettings(){const temporary=settingsPath+'.tmp';fs.writeFileSync(temporary,JSON.stringify(settings,null,2),{mode:0o600});fs.renameSync(temporary,settingsPath);}
  win=new BrowserWindow({...visibleBounds(settings.window,screen.getAllDisplays().map(d=>d.workArea)),minWidth:820,minHeight:540,show:!process.env.AMBER_TEST_DATA,backgroundColor:'#121315',frame:false,title:'Amber SSH',icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:!!process.env.AMBER_TEST_DATA}});
  if(settings.window?.maximized)win.maximize();
  let boundsTimer;function saveBounds(){clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>{if(!win.isDestroyed()&&!win.isMinimized()){settings.window={...win.getNormalBounds(),maximized:win.isMaximized()};try{saveSettings();}catch(error){win.webContents.send('ssh:event',{type:'notice',message:t("Не удалось сохранить размер окна: ")+error.message});}}},300);}
  win.on('resize',saveBounds);win.on('move',saveBounds);win.on('maximize',saveBounds);win.on('unmaximize',saveBounds);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
  if(process.env.AMBER_DEV_URL)win.loadURL(process.env.AMBER_DEV_URL);else win.loadFile(path.join(__dirname,'../dist/index.html'));
  wrap('profiles:list',()=>db.profiles.map(publicProfile));
  wrap('clipboard:write',text=>{if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>8388608)throw new Error(t("Выделение слишком большое для копирования"));clipboard.writeText(text);});
  wrap('clipboard:read',()=>{const text=clipboard.readText();if(text.length>20000)throw new Error(t("Для вставки поддерживается до 20 000 символов. Передайте большой файл через SFTP."));return text;});
  wrap('settings:get',()=>({fontSize:settings.fontSize,commands:settings.commands,language:settings.language}));
  wrap('settings:language',value=>{if(value!=='ru'&&value!=='en')throw new Error('Unsupported interface language');const previous=settings.language;settings.language=value;try{saveSettings();}catch(error){settings.language=previous;throw error;}setLanguage(value);return value;});
  wrap('settings:font',fontSize=>{if(!Number.isInteger(fontSize)||fontSize<10||fontSize>26)throw new Error(t("Размер шрифта должен быть от 10 до 26"));const old=settings.fontSize;settings.fontSize=fontSize;try{saveSettings();}catch(error){settings.fontSize=old;throw error;}return fontSize;});
  wrap('commands:save',raw=>{const commands=validateCommands(raw),old=settings.commands;settings.commands=commands;try{saveSettings();}catch(error){settings.commands=old;throw error;}return commands;});
  wrap('commands:run',async(id,commandId)=>{
    const s=sessions.get(id),command=settings.commands.find(c=>c.id===commandId);if(!s?.channel||s.closed)throw new Error(t("Сессия отключена"));if(!command)throw new Error(t("Команда не найдена"));
    const owner=db.profiles.find(p=>p.id===tabOwners.get(id));
    if(!await confirmations.request({kind:'command',sessionId:id,title:t("Выполнить быструю команду?"),message:`${command.name} · ${owner?.username||s.username}@${owner?.host||t("сервер")}`,preview:command.command,acceptLabel:t("Выполнить")}))return {canceled:true};
    if(sessions.get(id)!==s||s.closed||!s.channel)throw new Error(t("Сессия изменилась"));const input=command.command.replace(/\n/g,'\r')+'\r';s.channel.write(input);s.tx+=Buffer.byteLength(input);return {canceled:false};
  });
  require('./backup-ipc.cjs').registerBackups({wrap,dialog,win,db,persist,encrypt,decrypt,storePath,settingsPath,t});
  registerSftp({wrap,sessions,dialog,getWindow:()=>win,confirmations,emit});
  wrap('dialog:answer',(id,accepted)=>confirmations.answer(id,accepted));
  wrap('profiles:save',(raw,secrets={})=>{
    const p=validateProfile(raw),old=db.profiles.find(x=>x.id===p.id);
    if(typeof secrets.password!=='string'||typeof secrets.passphrase!=='string')throw new Error(t("Некорректные учётные данные"));
    if(/[\r\n\0]/.test(secrets.password))throw new Error(t("Пароль не должен содержать перевод строки"));
    const password=secrets.password || (old?.password?decrypt(old.password):sessionSecrets.get(p.id)?.password||'');
    const passphrase=secrets.passphrase || (old?.passphrase?decrypt(old.passphrase):sessionSecrets.get(p.id)?.passphrase||'');
    if(p.remember){p.password=password?encrypt(password):'';p.passphrase=passphrase?encrypt(passphrase):'';sessionSecrets.delete(p.id);}else{sessionSecrets.set(p.id,{password,passphrase});}
    db.profiles=old?db.profiles.map(x=>x.id===p.id?p:x):[...db.profiles,p];persist();return publicProfile(p);
  });
  wrap('profiles:remove',id=>{db.profiles=db.profiles.filter(p=>p.id!==id);sessionSecrets.delete(id);persist();});
  wrap('key:choose',async()=>{const r=await dialog.showOpenDialog(win,{title:t("Выберите приватный SSH-ключ OpenSSH / PEM"),properties:['openFile']});return r.canceled?'':r.filePaths[0];});
  wrap('ssh:connect',async(profileId,overrides={},size={cols:100,rows:30},resumeId)=>{
    const p=db.profiles.find(x=>x.id===profileId);if(!p)throw new Error(t("Подключение не найдено"));
    if(resumeId&&(tabOwners.get(resumeId)!==profileId||sessions.has(resumeId)))throw new Error(t("Эта вкладка уже подключается или недоступна"));
    if(!overrides||typeof overrides!=='object'||(overrides.password!==undefined&&(typeof overrides.password!=='string'||/[\r\n\0]/.test(overrides.password))))throw new Error(t("Некорректный пароль"));
    const secrets=sessionSecrets.get(p.id)||{};
    const password=overrides.password||decrypt(p.password)||secrets.password||'';
    const passphrase=overrides.passphrase||decrypt(p.passphrase)||secrets.passphrase||'';
    if(p.auth==='password'&&!password)throw new Error(t("Введите пароль для подключения"));
    const privateKey=p.auth==='key'?fs.readFileSync(p.keyPath):undefined;
    const s={id:resumeId||crypto.randomUUID(),client:new Client(),geometry:createTerminalSize(size),password,username:p.username,decoder:new StringDecoder('utf8'),rx:0,tx:0,prevRx:0,prevTx:0,closed:false,latency:null};sessions.set(s.id,s);tabOwners.set(s.id,profileId);
    emit(s,'status',{status:'connecting'});
    // Interactive keystrokes must not wait for TCP's small-packet batching.
    s.client.on('connect',()=>s.client.setNoDelay(true));
    s.client.on('ready',()=>{
      if(s.closed||sessions.get(s.id)!==s)return;
      clearTimeout(s.handshakeTimer);
      if(overrides.savePassword===true&&p.auth==='password'){
        try{
          const current=db.profiles.find(x=>x.id===p.id);
          if(current&&current.host===p.host&&current.port===p.port&&current.username===p.username&&current.auth===p.auth){
            const previous=db.profiles;const updated={...current,password:encrypt(password),remember:true};db.profiles=previous.map(x=>x.id===p.id?updated:x);
            try{persist();}catch(error){db.profiles=previous;throw error;}
            sessionSecrets.delete(p.id);emit(s,'credentials-saved',{profile:publicProfile(updated)});
          }
        }catch(error){emit(s,'notice',{message:t("Вход выполнен, но сохранить пароль не удалось: ")+error.message});}
      }
      const requestedSize=s.geometry.snapshot();
      s.client.shell({term:'xterm-256color',...requestedSize},(err,channel)=>{
        if(s.closed||sessions.get(s.id)!==s){channel?.end();return;}
        if(err){emit(s,'status',{status:'error',message:err.message});finish(s);return;}
        s.channel=channel;s.geometry.attach(channel,requestedSize);emit(s,'status',{status:'connected'});
        channel.on('data',data=>acceptOutput(s,data));channel.stderr.on('data',data=>acceptOutput(s,data));channel.on('close',()=>finish(s));
        probe(s,p);s.timer=setInterval(()=>{emit(s,'metrics',{rx:s.rx,tx:s.tx,rxRate:(s.rx-s.prevRx)/2,txRate:(s.tx-s.prevTx)/2,latency:s.latency});s.prevRx=s.rx;s.prevTx=s.tx;},2000);
        s.probeTimer=setInterval(()=>probe(s,p),15000);
        if(p.autoRoot){try{elevate(s);}catch(e){emit(s,'notice',{message:e.message});}}
      });
    });
    s.client.on('error',err=>{
      if(s.closed)return;
      const authFailed=err.level==='client-authentication';
      const message=authFailed?(p.auth==='password'?t("Сервер отклонил вход по паролю."):t("Сервер отклонил вход с SSH-ключом. Проверьте ключ и пользователя.")):err.message;
      emit(s,'status',{status:'error',message});
      if(authFailed&&p.auth==='password')emit(s,'auth-error',{profileId:p.id,message:t("Сервер не принял вход по паролю. Введите новый пароль или проверьте имя пользователя и доступ на сервере.")});
      finish(s);
    });
    s.client.on('close',()=>{clearInterval(s.probeTimer);finish(s);});
    const address=`${p.host}:${p.port}`;
    armHandshake(s);
    try{s.client.connect({host:p.host,port:p.port,username:p.username,password:p.auth==='password'?password:undefined,privateKey,passphrase:passphrase||undefined,readyTimeout:0,keepaliveInterval:15000,keepaliveCountMax:3,
      hostVerifier:(key,callback)=>{
        const fp=fingerprint(key),known=db.hosts[address];if(known===fp){callback(true);return;}
        clearTimeout(s.handshakeTimer);
        confirmations.request({kind:'host',sessionId:s.id,title:known?t("Ключ сервера изменился"):t("Доверять этому серверу?"),message:known?t("Ключ отличается от сохранённого. Если сервер не переустанавливали, проверьте причину изменения перед подключением."):t("Это первое подключение. Сверьте отпечаток ключа сервера и сохраните его для следующих подключений."),address,fingerprint:fp,previousFingerprint:known||'',acceptLabel:known?t("Принять новый ключ"):t("Доверять и подключиться"),cancelLabel:t("Отмена"),warning:!!known}).then(accepted=>{
          if(s.closed){callback(false);return;}
          armHandshake(s);
          if(accepted){db.hosts[address]=fp;persist();callback(true);}else callback(false);
        }).catch(()=>callback(false));
      }
    });}catch(error){finish(s);if(!resumeId)tabOwners.delete(s.id);throw error;}
    return {id:s.id};
  });
  wrap('ssh:disconnect',(id,forget=false)=>{const s=sessions.get(id);if(s)finish(s);if(forget===true)tabOwners.delete(id);});
  wrap('ssh:root',id=>{const s=sessions.get(id);if(!s)throw new Error(t("Сессия отключена"));elevate(s);});
  ipcMain.on('ssh:input',(e,id,data)=>{authorized(e);const s=sessions.get(id);if(s?.channel&&typeof data==='string'&&data.length<=1048576){s.channel.write(data);s.tx+=Buffer.byteLength(data);}});
  ipcMain.on('ssh:resize',(e,id,cols,rows)=>{authorized(e);sessions.get(id)?.geometry.update(cols,rows);});
  ipcMain.on('window:action',(e,action)=>{authorized(e);if(action==='close')win.close();if(action==='minimize')win.minimize();if(action==='maximize')win.isMaximized()?win.unmaximize():win.maximize();});
  let closeApproved=false,closePromptPending=false;
  const updateEnabled=app.isPackaged&&process.platform==='win32'&&!process.env.PORTABLE_EXECUTABLE_FILE&&fs.existsSync(path.join(process.resourcesPath,'amber-install-mode'));
  const updates=createUpdates({enabled:updateEnabled,version:app.getVersion(),updater:updateEnabled?require('electron-updater').autoUpdater:null,t,
    publish:update=>{if(!win.isDestroyed())win.webContents.send('ssh:event',{type:'update',update});},
    confirmRestart:async()=>!sessions.size||await confirmations.request({kind:'update',title:t('Перезапустить и обновить?'),message:t('Открытые SSH-сессии и передачи файлов будут закрыты. Сохранённые подключения и пароли останутся.'),acceptLabel:t('Перезапустить и обновить'),cancelLabel:t('Позже')}),
    beforeInstall:()=>{closeApproved=true;for(const s of sessions.values())finish(s);}
  });
  wrap('updates:state',()=>updates.get());wrap('updates:check',()=>updates.check());wrap('updates:download',()=>updates.download());wrap('updates:install',()=>updates.install());
  wrap('updates:release',()=>shell.openExternal('https://github.com/O1SEeez/amber-ssh/releases/latest'));
  if(updateEnabled&&!process.env.AMBER_TEST_DATA){const timer=setTimeout(()=>void updates.check(),10000);timer.unref();const interval=setInterval(()=>void updates.check(),6*60*60*1000);interval.unref();}

  win.on('close',event=>{
    if(!closeApproved&&sessions.size){event.preventDefault();if(closePromptPending)return;closePromptPending=true;
      confirmations.request({kind:'quit',title:t("Закрыть приложение?"),message:t("Все открытые SSH-сессии будут отключены. Сохранённые подключения останутся."),acceptLabel:t("Закрыть приложение"),cancelLabel:t("Остаться")}).then(accepted=>{closePromptPending=false;if(accepted&&!win.isDestroyed()){closeApproved=true;win.close();}});return;}
    confirmations.cancelAll();
    clearTimeout(boundsTimer);if(!win.isMinimized())settings.window={...win.getNormalBounds(),maximized:win.isMaximized()};try{saveSettings();}catch{}
    for(const s of sessions.values())finish(s);
  });
});
app.on('window-all-closed',()=>app.quit());
