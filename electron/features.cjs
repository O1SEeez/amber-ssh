const crypto=require('node:crypto');
const {validateProfile}=require('./security.cjs');
function exportConnections(profiles){
  return {format:'amber-ssh-connections',version:1,profiles:profiles.map(p=>({name:p.name,host:p.host,port:p.port,username:p.username,auth:p.auth}))};
}
function importConnections(raw){
  if(!raw||raw.format!=='amber-ssh-connections'||raw.version!==1||!Array.isArray(raw.profiles)||raw.profiles.length>1000)throw new Error('Неверный формат экспорта Amber SSH');
  return raw.profiles.map(p=>{
    const safe=validateProfile({name:p?.name,host:p?.host,port:p?.port,username:p?.username,auth:p?.auth,keyPath:p?.auth==='key'?'select-key-again':'',remember:false,autoRoot:false});
    return {...safe,id:crypto.randomUUID(),keyPath:'',remember:false,autoRoot:false};
  });
}
function connectionIdentity(p){return JSON.stringify([p.host.toLowerCase(),p.port,p.username,p.auth]);}
function mergeConnections(existing,incoming){const seen=new Set(existing.map(connectionIdentity));const added=[];for(const p of incoming){const key=connectionIdentity(p);if(!seen.has(key)){seen.add(key);added.push(p);}}return {profiles:[...existing,...added],added:added.length,skipped:incoming.length-added.length};}
function validateCommands(raw){
  if(!Array.isArray(raw)||raw.length>100)throw new Error('Можно сохранить до 100 команд');
  const seen=new Set();return raw.map(item=>{
    if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||typeof item.command!=='string'||!item.command.trim()||item.command.length>8000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(item.command))throw new Error('Укажите название и команду без управляющих символов');
    const id=typeof item.id==='string'&&/^[\w-]{1,80}$/.test(item.id)?item.id:crypto.randomUUID();if(seen.has(id))throw new Error('Повторный идентификатор команды');seen.add(id);
    return {id,name:item.name.trim(),command:item.command.replace(/\r\n?/g,'\n').trim()};
  });
}
function remotePath(value){if(typeof value!=='string'||!value||value.length>4096||/[\x00-\x1f\x7f]/.test(value))throw new Error('Некорректный путь SFTP');return value;}
function remoteName(value){if(typeof value!=='string'||!value||value==='.'||value==='..'||/[\/\\\x00-\x1f\x7f]/.test(value))throw new Error('Некорректное имя файла');return value;}
function visibleBounds(saved,displays){
  if(!saved||!Number.isInteger(saved.width)||!Number.isInteger(saved.height))return {width:1280,height:820};
  const work=displays.find(d=>Number.isInteger(saved.x)&&Number.isInteger(saved.y)&&saved.x<d.x+d.width-100&&saved.x+saved.width>d.x+100&&saved.y<d.y+d.height-50&&saved.y+saved.height>d.y+50)||displays[0];
  if(!work)return {width:1280,height:820};
  const width=Math.min(work.width,Math.max(820,Math.min(3840,saved.width))),height=Math.min(work.height,Math.max(540,Math.min(2160,saved.height)));
  return {width,height,x:Math.max(work.x,Math.min(work.x+work.width-width,Number.isInteger(saved.x)?saved.x:work.x)),y:Math.max(work.y,Math.min(work.y+work.height-height,Number.isInteger(saved.y)?saved.y:work.y))};
}
module.exports={exportConnections,importConnections,mergeConnections,validateCommands,remotePath,remoteName,visibleBounds};
