const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('amber', {
  profiles:()=>ipcRenderer.invoke('profiles:list'),
  save:(profile,secrets)=>ipcRenderer.invoke('profiles:save',profile,secrets),
  remove:id=>ipcRenderer.invoke('profiles:remove',id),
  key:()=>ipcRenderer.invoke('key:choose'),
  connect:(id,secrets,size,resumeId)=>ipcRenderer.invoke('ssh:connect',id,secrets,size,resumeId),
  disconnect:(id,forget)=>ipcRenderer.invoke('ssh:disconnect',id,forget),
  root:id=>ipcRenderer.invoke('ssh:root',id),
  answer:(id,accepted)=>ipcRenderer.invoke('dialog:answer',id,accepted),
  input:(id,data)=>ipcRenderer.send('ssh:input',id,data),
  resize:(id,cols,rows)=>ipcRenderer.send('ssh:resize',id,cols,rows),
  window:action=>ipcRenderer.send('window:action',action),
  onEvent:callback=>{ const handler=(_event,value)=>callback(value); ipcRenderer.on('ssh:event',handler); return ()=>ipcRenderer.removeListener('ssh:event',handler); }
});
