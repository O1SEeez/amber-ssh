const {t}=require('./localization.cjs');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {remotePath,remoteName}=require('./features.cjs');
const call=(sftp,method,...args)=>new Promise((resolve,reject)=>sftp[method](...args,(error,value)=>error?reject(error):resolve(value)));
function registerSftp({wrap,sessions,dialog,getWindow,confirmations,emit}){
  function live(id){const s=sessions.get(id);if(!s?.channel||s.closed)throw new Error(t("SSH-сессия отключена"));return s;}
  async function channel(s){
    if(!s.sftpPromise)s.sftpPromise=new Promise((resolve,reject)=>s.client.sftp((error,value)=>{if(error){s.sftpPromise=null;reject(error);}else if(s.closed){value.end();reject(new Error(t("SSH-сессия отключена")));}else resolve(value);}));
    const value=await s.sftpPromise;if(live(s.id)!==s)throw new Error(t("Сессия изменилась"));return value;
  }
  function idle(s){if(s.transfer)throw new Error(t("Дождитесь окончания текущей передачи"));}
  async function transfer(s,sftp,direction,remote,local,total,overwrite){
    const id=crypto.randomUUID(),signal=s.transfer;signal.signal.throwIfAborted();
    const temporary=direction==='download'?local+'.amber-'+id+'.part':null;let bytes=0,last=0;
    const notify=(status,error)=>emit(s,'transfer',{transferId:id,direction,name:path.posix.basename(remote),bytes,total,status,message:error});
    const counter=new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;const now=Date.now();if(now-last>100){last=now;notify('transferring');}done(null,chunk);}});
    notify('transferring');
    try{
      const source=direction==='upload'?fs.createReadStream(local):sftp.createReadStream(remote);
      const target=direction==='upload'?sftp.createWriteStream(remote,{flags:overwrite?'w':'wx',mode:0o600}):fs.createWriteStream(temporary,{flags:'wx'});
      await pipeline(source,counter,target,{signal:signal.signal});
      if(live(s.id)!==s)throw new Error(t("SSH-сессия отключена"));
      if(temporary)await fs.promises.rename(temporary,local);
      notify('complete');return {canceled:false,name:path.posix.basename(remote),bytes};
    }catch(error){if(temporary)await fs.promises.unlink(temporary).catch(()=>{});const message=error.name==='AbortError'?t("Передача отменена"):error.message;notify('error',message);throw new Error(message);}
    finally{if(s.transfer===signal)s.transfer=null;}
  }
  wrap('sftp:list',async(id,requested='.')=>{
    const s=live(id),sftp=await channel(s);const directory=await call(sftp,'realpath',remotePath(requested));const items=await call(sftp,'readdir',directory);live(id);
    return {path:directory,entries:items.filter(item=>{try{remoteName(item.filename);return true;}catch{return false;}}).map(item=>({name:item.filename,directory:item.attrs.isDirectory(),link:item.attrs.isSymbolicLink(),size:item.attrs.size,modified:item.attrs.mtime})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name))};
  });
  wrap('sftp:upload',async(id,directory)=>{
    const s=live(id);idle(s);s.transfer=new AbortController();
    try{
      const selected=await dialog.showOpenDialog(getWindow(),{title:t("Загрузить файл на сервер"),properties:['openFile']});if(selected.canceled)return {canceled:true};
      if(live(id)!==s)throw new Error(t("Сессия изменилась"));
      const local=selected.filePaths[0],name=remoteName(path.basename(local)),sftp=await channel(s),canonical=await call(sftp,'realpath',remotePath(directory));
      const remote=path.posix.join(canonical,name);let existing;
      try{existing=await call(sftp,'lstat',remote);}catch(error){if(error.code!==2)throw error;}
      if(existing&&!existing.isFile())throw new Error(t("На сервере существует папка или ссылка с этим именем"));
      if(existing&&!await confirmations.request({kind:'transfer',sessionId:id,title:t("Заменить файл на сервере?"),message:t("{0}\nСуществующий файл будет перезаписан. При обрыве загрузки он может остаться неполным.",[remote]),acceptLabel:t("Заменить файл"),warning:true}))return {canceled:true};
      if(live(id)!==s)throw new Error(t("Сессия изменилась"));
      const stat=await fs.promises.stat(local);if(!stat.isFile())throw new Error(t("Выберите обычный файл"));
      return await transfer(s,sftp,'upload',remote,local,stat.size,!!existing);
    }finally{s.transfer=null;}
  });
  wrap('sftp:download',async(id,requested)=>{
    const s=live(id);idle(s);s.transfer=new AbortController();
    try{
      const sftp=await channel(s),remote=remotePath(requested),stat=await call(sftp,'stat',remote);if(!stat.isFile())throw new Error(t("Можно скачать только файл"));
      const selected=await dialog.showSaveDialog(getWindow(),{title:t("Скачать файл с сервера"),defaultPath:remoteName(path.posix.basename(remote))});if(selected.canceled)return {canceled:true};
      if(live(id)!==s)throw new Error(t("Сессия изменилась"));
      let localStat;try{localStat=await fs.promises.lstat(selected.filePath);}catch(error){if(error.code!=='ENOENT')throw error;}
      if(localStat&&!localStat.isFile())throw new Error(t("Путь назначения должен быть обычным файлом"));
      if(localStat&&!await confirmations.request({kind:'transfer',sessionId:id,title:t("Заменить локальный файл?"),message:t("Скачанный файл заменит выбранный файл на компьютере после успешной передачи."),acceptLabel:t("Заменить файл"),warning:true}))return {canceled:true};
      if(live(id)!==s)throw new Error(t("Сессия изменилась"));
      return await transfer(s,sftp,'download',remote,selected.filePath,stat.size,false);
    }finally{s.transfer=null;}
  });
  wrap('sftp:cancel',id=>{live(id).transfer?.abort();});
}
module.exports={registerSftp};
