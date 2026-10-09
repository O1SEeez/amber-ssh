function createUpdates({updater,enabled,version,publish,confirmRestart,beforeInstall,t}){
  let state={phase:enabled?'idle':'unsupported',currentVersion:version,version:'',percent:0},busy=false,installing=false;
  const set=change=>{state={...state,...change};publish({...state});};
  if(enabled){
    updater.autoDownload=false;
    updater.autoInstallOnAppQuit=false;
    updater.allowPrerelease=false;
    updater.allowDowngrade=false;
    updater.on('checking-for-update',()=>set({phase:'checking',error:''}));
    updater.on('update-available',info=>set({phase:'available',version:info.version,percent:0,error:''}));
    updater.on('update-not-available',()=>set({phase:'current',version:'',error:''}));
    let lastProgress=0;
    updater.on('download-progress',progress=>{const now=Date.now();if(now-lastProgress<200&&progress.percent<100)return;lastProgress=now;set({phase:'downloading',percent:Math.max(0,Math.min(100,Math.floor(progress.percent)))});});
    updater.on('update-downloaded',info=>set({phase:'ready',version:info.version,percent:100,error:''}));
    updater.on('error',()=>{installing=false;set({phase:'error',error:t('Не удалось обновить приложение. Проверьте интернет и попробуйте снова.')});});
  }
  async function check(){
    if(!enabled||busy||installing||['downloading','ready'].includes(state.phase))return {...state};
    busy=true;
    try{set({phase:'checking',error:''});await updater.checkForUpdates();}
    catch{set({phase:'error',error:t('Не удалось проверить обновления. Проверьте интернет и попробуйте снова.')});}
    finally{busy=false;}return {...state};
  }
  async function download(){
    if(!enabled||busy||state.phase!=='available')return {...state};
    busy=true;set({phase:'downloading',percent:0,error:''});
    try{await updater.downloadUpdate();}
    catch{set({phase:'error',error:t('Не удалось скачать обновление. Проверьте интернет и попробуйте снова.')});}
    finally{busy=false;}return {...state};
  }
  async function install(){
    if(!enabled||state.phase!=='ready'||installing)return {canceled:true};
    installing=true;
    try{
      if(!await confirmRestart()){installing=false;return {canceled:true};}
      // Check again after the confirmation: a failed download must never install.
      if(state.phase!=='ready'){installing=false;return {canceled:true};}
      beforeInstall();set({phase:'installing'});updater.quitAndInstall(true,true);
      return {canceled:false};
    }catch{installing=false;set({phase:'error',error:t('Не удалось установить обновление. Попробуйте снова.')});return {canceled:true};}
  }
  return {get:()=>({...state}),check,download,install};
}
module.exports={createUpdates};
