const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {exportConnections,importConnections,mergeConnections}=require('./features.cjs');
const {FORMAT,encryptBackup,decryptBackup,validateEnvelope}=require('./backup.cjs');
function registerBackups({wrap,dialog,win,db,persist,encrypt,decrypt,storePath,settingsPath,t}){
  let pending,timer,busy=false;
  function clear(){clearTimeout(timer);if(pending?.profiles)for(const p of pending.profiles){p.password='';p.passphrase='';}pending=null;}
  function install(value){clear();pending={...value,token:crypto.randomUUID()};timer=setTimeout(clear,5*60*1000);timer.unref();return pending;}
  function current(token){if(!pending||typeof token!=='string'||pending.token!==token)throw new Error('Предпросмотр импорта устарел');return pending;}
  function preview(p){const merged=mergeConnections(db.profiles,p.profiles);return {canceled:false,encrypted:p.encrypted,locked:false,token:p.token,added:merged.added,skipped:merged.skipped,names:p.profiles.slice(0,10).map(x=>x.name)};}
  function resolved(file){return fs.existsSync(file)?fs.realpathSync(file):path.resolve(file);}
  function assertDestination(file){const target=resolved(file).toLowerCase();if([storePath,settingsPath].some(p=>resolved(p).toLowerCase()===target))throw new Error('Выберите другой файл: нельзя заменить внутреннюю базу приложения');}
  async function exclusive(action){if(busy)throw new Error('Обработка файла уже выполняется');busy=true;try{return await action();}finally{busy=false;}}
  wrap('profiles:export',options=>exclusive(async()=>{
    if(options!==undefined&&(!options||options.encrypted!==true||typeof options.password!=='string'))throw new Error('Некорректные параметры экспорта');
    const secured=options?.encrypted===true;
    const selected=await dialog.showSaveDialog(win,{title:t(secured?'Экспорт с паролями':'Экспорт подключений без секретов'),defaultPath:secured?'amber-ssh-backup.amber':'amber-ssh-connections.json',filters:[{name:secured?'Amber SSH':'JSON',extensions:[secured?'amber':'json']}]});
    if(selected.canceled)return {canceled:true};assertDestination(selected.filePath);
    let data;
    if(secured){
      // Only persisted secrets are exported. Temporary session passwords stay in memory.
      const profiles=db.profiles.map(p=>({...p,password:p.remember?decrypt(p.password):'',passphrase:p.remember?decrypt(p.passphrase):''}));
      try{data=await encryptBackup(profiles,options.password);}finally{for(const p of profiles){p.password='';p.passphrase='';}}
    }else data=exportConnections(db.profiles);
    const temporary=selected.filePath+'.'+crypto.randomUUID()+'.tmp';
    try{fs.writeFileSync(temporary,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});fs.renameSync(temporary,selected.filePath);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
    return {canceled:false,count:db.profiles.length,encrypted:secured};
  }));
  wrap('profiles:import-preview',()=>exclusive(async()=>{
    clear();const selected=await dialog.showOpenDialog(win,{title:t('Импорт подключений'),properties:['openFile'],filters:[{name:'Amber SSH / JSON',extensions:['amber','json']}]});
    if(selected.canceled)return {canceled:true};const file=selected.filePaths[0];
    if(fs.statSync(file).size>3*1024*1024)throw new Error('Файл импорта слишком большой');
    let raw;try{raw=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new Error('Неверный формат экспорта Amber SSH');}
    if(raw?.format===FORMAT){validateEnvelope(raw);const p=install({raw,encrypted:true});return {canceled:false,encrypted:true,locked:true,token:p.token};}
    return preview(install({profiles:importConnections(raw),encrypted:false}));
  }));
  wrap('profiles:import-unlock',(token,password)=>exclusive(async()=>{
    const p=current(token);if(!p.raw)throw new Error('Предпросмотр импорта устарел');
    const profiles=await decryptBackup(p.raw,password);
    if(pending!==p){for(const profile of profiles){profile.password='';profile.passphrase='';}throw new Error('Предпросмотр импорта устарел');}
    return preview(install({profiles,encrypted:true}));
  }));
  wrap('profiles:import-apply',(token,accepted)=>exclusive(async()=>{
    const p=current(token);if(accepted!==true){clear();return {canceled:true};}
    if(!p.profiles)throw new Error('Сначала введите пароль файла');
    try{
      const previous=db.profiles,merged=mergeConnections(previous,p.profiles);
      // Prepare all target-OS ciphertext before modifying the database.
      const added=merged.profiles.slice(previous.length).map(profile=>{
        const {password,passphrase,...safe}=profile;
        return {...safe,remember:!!(password||passphrase),...(password?{password:encrypt(password)}:{}),...(passphrase?{passphrase:encrypt(passphrase)}:{})};
      });
      db.profiles=[...previous,...added];try{persist();}catch(error){db.profiles=previous;throw error;}
      return {canceled:false,added:merged.added,skipped:merged.skipped};
    }finally{clear();}
  }));
  win.once('closed',clear);
}
module.exports={registerBackups};
