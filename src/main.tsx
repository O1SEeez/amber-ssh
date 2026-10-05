import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import {SearchAddon} from '@xterm/addon-search';
import {Plus, X, Minus, Square, Terminal as TerminalIcon, Server, MoreVertical, Pencil, Trash2, KeyRound, ArrowDown, ArrowUp, Search, Shield, PlugZap, Eye, EyeOff, FolderOpen, Settings2} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import './style.css';
import {useConfirmation,type ConfirmationOptions} from './Confirmation';
import {Commands,ServerPalette,SftpPane,type QuickCommand} from './Features';
type Profile={id:string;name:string;host:string;port:number;username:string;auth:'password'|'key';keyPath:string;remember:boolean;autoRoot:boolean;hasPassword?:boolean;hasPassphrase?:boolean};
type Result<T=unknown>={ok:boolean;value:T;error?:string};
type SSHEvent={id:string;type:string;data?:string;status?:string;message?:string;rx?:number;tx?:number;rxRate?:number;txRate?:number;latency?:number|null;requestId?:string;profileId?:string;profile?:Profile}&Partial<ConfirmationOptions>;
type Tab={id:string;profile:Profile;status:string;error?:string;rx:number;tx:number;rxRate:number;txRate:number;latency:number|null};
declare global {interface Window{amber?:{profiles:()=>Promise<Result<Profile[]>>;save:(p:Profile,s:{password:string;passphrase:string})=>Promise<Result<Profile>>;remove:(id:string)=>Promise<Result>;key:()=>Promise<Result<string>>;connect:(id:string,s:object,size:object,resumeId?:string)=>Promise<Result<{id:string}>>;disconnect:(id:string,forget?:boolean)=>Promise<Result>;root:(id:string)=>Promise<Result>;answer:(id:string,accepted:boolean)=>Promise<Result>;input:(id:string,data:string)=>void;resize:(id:string,cols:number,rows:number)=>void;window:(action:string)=>void;settings:()=>Promise<Result<{fontSize:number;commands:QuickCommand[]}>>;font:(size:number)=>Promise<Result<number>>;commandsSave:(commands:QuickCommand[])=>Promise<Result<QuickCommand[]>>;commandsRun:(id:string,commandId:string)=>Promise<Result>;exportProfiles:()=>Promise<Result<{canceled:boolean;count:number}>>;importPreview:()=>Promise<Result<{canceled:boolean;token:string;added:number;skipped:number;names:string[]}>>;importApply:(token:string,accepted:boolean)=>Promise<Result<{canceled:boolean;added:number;skipped:number}>>;sftpList:(id:string,path:string)=>Promise<Result<{path:string;entries:{name:string;directory:boolean;link:boolean;size:number;modified:number}[]}>>;sftpUpload:(id:string,path:string)=>Promise<Result<{canceled:boolean}>>;sftpDownload:(id:string,path:string)=>Promise<Result<{canceled:boolean}>>;sftpCancel:(id:string)=>Promise<Result>;onEvent:(cb:(e:SSHEvent)=>void)=>()=>void}}}
const api=window.amber;
let preferredFontSize=14;
function applyFont(size:number){preferredFontSize=size;for(const [id,t] of terminals){t.terminal.options.fontSize=size;t.fit.fit();api?.resize(id,t.terminal.cols,t.terminal.rows);}}
const fresh=():Profile=>({id:'',name:'',host:'',port:22,username:'',auth:'password',keyPath:'',remember:true,autoRoot:false});
const rate=(n:number)=>n>=1048576?`${(n/1048576).toFixed(1)} MB/s`:`${(n/1024).toFixed(1)} KB/s`;
const volume=(n:number)=>n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${(n/1024).toFixed(1)} KB`;
const buffers=new Map<string,string[]>();
const terminals=new Map<string,{terminal:Terminal;fit:FitAddon;search:SearchAddon}>();
const lastStatus=new Map<string,{status:string;error?:string}>();
function TerminalPane({tab,active,onFind,onConfirm,onFontChange}:{tab:Tab;active:boolean;onFind:()=>void;onConfirm:(options:ConfirmationOptions)=>Promise<boolean>;onFontChange:(size:number)=>void}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const term=new Terminal({cursorBlink:true,fontSize:preferredFontSize,fontFamily:'Cascadia Code, Consolas, monospace',lineHeight:1.25,scrollback:10000,allowProposedApi:false,theme:{background:'#121315',foreground:'#d9dce2',cursor:'#d99758',selectionBackground:'#d9975844',black:'#202226',red:'#ed7777',green:'#8abe83',yellow:'#dfbc7c',blue:'#82a9e0',magenta:'#b698db',cyan:'#7fbfc4',white:'#dedee0'}});
    const fit=new FitAddon(),search=new SearchAddon();term.loadAddon(fit);term.loadAddon(search);term.open(ref.current!);terminals.set(tab.id,{terminal:term,fit,search});
    for(const data of buffers.get(tab.id)||[])term.write(data);buffers.delete(tab.id);
    const input=term.onData(data=>api?.input(tab.id,data));
    let pastePending=false;
    async function paste(text:string){
      if(pastePending)return;pastePending=true;
      try{
        if(text.length>20000){await onConfirm({kind:'paste',title:'Слишком большой текст',message:'Для вставки команд поддерживается до 20 000 символов. Передайте большой файл через SFTP.',acceptLabel:'Понятно'});return;}
        if(/[\r\n]/.test(text)&&!await onConfirm({kind:'paste',title:'Вставить несколько строк?',message:'Этот текст будет отправлен в активную сессию. Переводы строк могут выполнить команды на сервере.',preview:text,acceptLabel:'Вставить'}))return;
        term.paste(text);
      }finally{pastePending=false;}
    }
    const nativePaste=(event:ClipboardEvent)=>{const value=event.clipboardData?.getData('text/plain');if(value!==undefined){event.preventDefault();event.stopImmediatePropagation();void paste(value);}};
    ref.current!.addEventListener('paste',nativePaste,true);
    term.attachCustomKeyEventHandler(event=>{
      if(event.type!=='keydown')return true;
      if(event.ctrlKey&&(event.key==='f'||event.key==='F')){onFind();return false;}
      if(event.ctrlKey&&event.shiftKey&&(event.key==='C'||event.key==='c')){navigator.clipboard.writeText(term.getSelection()).catch(()=>{});return false;}
      if(event.ctrlKey&&event.shiftKey&&(event.key==='V'||event.key==='v')){navigator.clipboard.readText().then(async text=>{
        await paste(text);
      }).catch(()=>{});return false;}
      if(event.ctrlKey&&['+','=','-','0'].includes(event.key)){onFontChange(event.key==='0'?14:Math.max(10,Math.min(26,preferredFontSize+(event.key==='-'?-1:1))));return false;}
      return true;
    });
    const observer=new ResizeObserver(()=>{if(ref.current?.offsetWidth){fit.fit();api?.resize(tab.id,term.cols,term.rows);}});observer.observe(ref.current!);
    return()=>{ref.current?.removeEventListener('paste',nativePaste,true);observer.disconnect();input.dispose();term.dispose();terminals.delete(tab.id);buffers.delete(tab.id);};
  },[tab.id]);
  useEffect(()=>{if(active){requestAnimationFrame(()=>{const t=terminals.get(tab.id);t?.fit.fit();t?.terminal.focus();if(t)api?.resize(tab.id,t.terminal.cols,t.terminal.rows);});}},[active,tab.id]);
  return <div className={`terminal-pane ${active?'visible':''}`} ref={ref}/>;
}
function App(){
  const {confirm,dismiss,dialog:confirmationDialog}=useConfirmation();
  const [profiles,setProfiles]=useState<Profile[]>([]),[tabs,setTabs]=useState<Tab[]>([]),[active,setActive]=useState('');
  const [editing,setEditing]=useState<Profile|null>(null),[password,setPassword]=useState(''),[passphrase,setPassphrase]=useState('');
  const [showPassword,setShowPassword]=useState(false),[advanced,setAdvanced]=useState(false),[saving,setSaving]=useState(false);
  const [filter,setFilter]=useState(''),[notice,setNotice]=useState(''),[formError,setFormError]=useState(''),[menu,setMenu]=useState(false);
  const [context,setContext]=useState<{p:Profile;x:number;y:number}|null>(null),[find,setFind]=useState(false),[query,setQuery]=useState('');
  const [login,setLogin]=useState<{profile:Profile;tabId?:string;failed?:boolean}|null>(null),[loginPassword,setLoginPassword]=useState(''),[loginPassphrase,setLoginPassphrase]=useState(''),[loginRemember,setLoginRemember]=useState(false),[loginError,setLoginError]=useState('');
  const [commands,setCommands]=useState<QuickCommand[]>([]),[commandsOpen,setCommandsOpen]=useState(false),[paletteOpen,setPaletteOpen]=useState(false),[toolsOpen,setToolsOpen]=useState(false),[sftpTab,setSftpTab]=useState('');
  const profilesRef=useRef(profiles);profilesRef.current=profiles;
  const reconnecting=useRef(new Set<string>());
  const tabsRef=useRef(tabs);tabsRef.current=tabs;
  const current=tabs.find(t=>t.id===active);
  async function reload(){if(api){const r=await api.profiles();if(r.ok)setProfiles(r.value);else setNotice(r.error||'Ошибка чтения');}}
  useEffect(()=>{reload();api?.settings().then(r=>{if(r.ok){applyFont(r.value.fontSize);setCommands(r.value.commands);}else setNotice(r.error||'Ошибка чтения настроек');});return api?.onEvent(e=>{
    if(e.type==='confirmation'&&e.requestId){confirm(e as ConfirmationOptions,e.requestId).then(accepted=>api?.answer(e.requestId!,accepted));return;}
    if(e.type==='confirmation-dismissed'&&e.requestId){dismiss(e.requestId);return;}
    if(e.type==='auth-error'){
      const p=profilesRef.current.find(p=>p.id===e.profileId);if(p){setNotice('');setLogin({profile:p,tabId:e.id,failed:true});setLoginPassword('');setLoginPassphrase('');setLoginRemember(p.remember);setLoginError(e.message||'Проверьте пароль');setActive(e.id);}return;
    }
    if(e.type==='credentials-saved'&&e.profile){const p=e.profile;setProfiles(prev=>prev.map(x=>x.id===p.id?p:x));setTabs(prev=>prev.map(t=>t.profile.id===p.id?{...t,profile:p}:t));return;}
    if(e.type==='data'){
      const t=terminals.get(e.id);if(t)t.terminal.write(e.data||'');else {const b=buffers.get(e.id)||[];b.push(e.data||'');if(b.length>500)b.shift();buffers.set(e.id,b);}
    }else if(e.type==='status'){const previous=lastStatus.get(e.id);const status=previous?.status==='error'&&e.status==='disconnected'?'error':e.status||'disconnected';const error=['connecting','connected'].includes(status)?undefined:e.message||previous?.error;lastStatus.set(e.id,{status,error});setTabs(prev=>prev.map(t=>t.id===e.id?{...t,status,error,...(e.status==='disconnected'?{rxRate:0,txRate:0,latency:null}:{})}:t));if(e.message)setNotice(e.message);
    }else if(e.type==='metrics')setTabs(prev=>prev.map(t=>t.id===e.id?{...t,rx:e.rx||0,tx:e.tx||0,rxRate:e.rxRate||0,txRate:e.txRate||0,latency:e.latency??null}:t));
    else if(e.type==='notice')setNotice(e.message||'');
  });},[]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),7000);return()=>clearTimeout(t);},[notice]);
  useEffect(()=>{const close=()=>{setContext(null);setMenu(false);setToolsOpen(false);};window.addEventListener('click',close);const key=(e:KeyboardEvent)=>{if(e.ctrlKey&&e.key.toLowerCase()==='k'&&!document.querySelector('[aria-modal="true"]')){e.preventDefault();e.stopPropagation();setPaletteOpen(true);return;}if(e.key==='Escape'){setPaletteOpen(false);setCommandsOpen(false);setToolsOpen(false);setEditing(null);setLogin(null);setContext(null);setMenu(false);setFind(false);}if(e.ctrlKey&&e.key==='Tab'&&tabsRef.current.length){e.preventDefault();setActive(prev=>{const ts=tabsRef.current;return ts[(ts.findIndex(t=>t.id===prev)+1)%ts.length].id;});}};window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('click',close);window.removeEventListener('keydown',key,true);};},[]);
  function edit(p:Profile){setEditing({...p});setPassword('');setPassphrase('');setShowPassword(false);setAdvanced(false);setFormError('');setContext(null);}
  async function save(e:React.FormEvent){e.preventDefault();if(!api||!editing)return;setSaving(true);const r=await api.save(editing,{password,passphrase});setSaving(false);if(!r.ok){setFormError(r.error||'Ошибка сохранения');return;}setEditing(null);setPassword('');setPassphrase('');await reload();}
  async function connect(p:Profile,secrets:object={},existingId?:string){
    if(!api){setNotice('Это браузерный просмотр. Для SSH запустите приложение Windows.');return;}
    if(p.auth==='password'&&!p.hasPassword&&Object.keys(secrets).length===0){setLogin({profile:p,tabId:existingId});setLoginPassword('');setLoginPassphrase('');setLoginRemember(p.remember);setLoginError('');return;}
    if(existingId&&reconnecting.current.has(existingId))return;
    const term=existingId?terminals.get(existingId)?.terminal:undefined;
    if(existingId){reconnecting.current.add(existingId);lastStatus.delete(existingId);setTabs(prev=>prev.map(t=>t.id===existingId?{...t,profile:p,status:'connecting',error:undefined,rx:0,tx:0,rxRate:0,txRate:0,latency:null}:t));setActive(existingId);}
    setLogin(null);setLoginPassword('');setLoginPassphrase('');setLoginError('');
    const r=await api.connect(p.id,secrets,{cols:term?.cols||110,rows:term?.rows||32},existingId);
    if(existingId)reconnecting.current.delete(existingId);
    if(!r.ok){if(existingId)setTabs(prev=>prev.map(t=>t.id===existingId?{...t,status:'error',error:r.error}:t));setNotice(r.error||'Ошибка подключения');return;}
    if(existingId){term?.write('\x1b[?1049l\x1b[0m\r\n\x1b[38;5;180m── Новое подключение · '+new Date().toLocaleTimeString()+' ──\x1b[0m\r\n');}
    else{const known=lastStatus.get(r.value.id);const t:Tab={id:r.value.id,profile:p,status:known?.status||'connecting',error:known?.error,rx:0,tx:0,rxRate:0,txRate:0,latency:null};setTabs(prev=>[...prev,t]);setActive(t.id);}
  }
  async function reconnect(t:Tab){const p=profilesRef.current.find(p=>p.id===t.profile.id);if(!p){setNotice('Подключение удалено из списка. Добавьте его снова.');return;}await connect(p,{},t.id);}
  async function closeTab(t:Tab){if(['connected','connecting'].includes(t.status)&&!await confirm({kind:'session',title:'Закрыть сессию?',message:`Подключение к «${t.profile.name}» будет закрыто. Сохранённые данные сервера останутся.`,acceptLabel:'Закрыть сессию',cancelLabel:'Остаться'}))return;await api?.disconnect(t.id,true);lastStatus.delete(t.id);setTabs(prev=>{const next=prev.filter(x=>x.id!==t.id);if(active===t.id)setActive(next.at(-1)?.id||'');return next;});}
  async function remove(p:Profile){if(!await confirm({kind:'remove',title:'Удалить подключение?',message:`«${p.name}» и сохранённые данные доступа будут удалены из списка. Открытые сессии продолжат работать.`,acceptLabel:'Удалить',warning:true}))return;const r=await api?.remove(p.id);if(r&&!r.ok)setNotice(r.error||'Ошибка');await reload();}
  function patch(p:Partial<Profile>){setEditing(prev=>prev?{...prev,...p}:prev);}
  async function root(){if(!current)return;const r=await api?.root(current.id);if(r&&!r.ok)setNotice(r.error||'Ошибка sudo');}
  async function saveCommands(next:QuickCommand[]){const r=await api?.commandsSave(next);if(r?.ok){setCommands(r.value);return undefined;}return r?.error||'Не удалось сохранить команды';}
  function font(size:number){applyFont(size);api?.font(size).then(r=>{if(!r.ok)setNotice(r.error||'Не удалось сохранить размер шрифта');});}
  async function runCommand(id:string){if(!current)return;setCommandsOpen(false);const r=await api?.commandsRun(current.id,id);if(r&&!r.ok)setNotice(r.error||'Не удалось выполнить команду');}
  async function exportProfiles(){setToolsOpen(false);const r=await api?.exportProfiles();if(r?.ok&&!r.value.canceled)setNotice('Подключения экспортированы без паролей и ключей.');else if(r&&!r.ok)setNotice(r.error||'Ошибка экспорта');}
  async function importProfiles(){setToolsOpen(false);const preview=await api?.importPreview();if(!preview?.ok){if(preview)setNotice(preview.error||'Ошибка импорта');return;}if(preview.value.canceled)return;const p=preview.value;const accepted=await confirm({kind:'import',title:'Импортировать подключения?',message:'Будет добавлено: '+p.added+'. Дубликатов пропущено: '+p.skipped+'. Пароли и ключи потребуется указать заново. Переход в root выключен.',acceptLabel:'Импортировать'});const r=await api?.importApply(p.token,accepted);if(r?.ok&&!r.value.canceled){await reload();setNotice('Добавлено подключений: '+r.value.added);}else if(r&&!r.ok)setNotice(r.error||'Ошибка импорта');}
  return <div className="app">
    <header className="titlebar"><div className="brand"><TerminalIcon size={18}/><span>Amber SSH</span><span className="version">0.2.0</span></div><div className="window-buttons"><button aria-label="Свернуть" onClick={()=>api?.window('minimize')}><Minus size={15}/></button><button aria-label="Развернуть" onClick={()=>api?.window('maximize')}><Square size={12}/></button><button className="window-close" aria-label="Закрыть приложение" onClick={()=>api?.window('close')}><X size={17}/></button></div></header>
    <div className="workspace"><aside className="sidebar"><div className="sidebar-heading">Подключения <span>{profiles.length||''}</span><button className="icon-button" title="Поиск и управление подключениями" aria-label="Управление подключениями" onClick={e=>{e.stopPropagation();setToolsOpen(!toolsOpen);}}><MoreVertical size={16}/></button>{toolsOpen&&<div className="dropdown sidebar-tools" onClick={e=>e.stopPropagation()}><button onClick={()=>{setPaletteOpen(true);setToolsOpen(false);}}><Search size={15}/>Найти сервер · Ctrl+K</button><button onClick={()=>{setCommandsOpen(true);setToolsOpen(false);}}><TerminalIcon size={15}/>Быстрые команды</button><button onClick={exportProfiles}><ArrowUp size={15}/>Экспорт подключений</button><button onClick={importProfiles}><ArrowDown size={15}/>Импорт подключений</button></div>}</div>
      {profiles.length>5&&<div className="filter"><Search size={14}/><input placeholder="Найти сервер" value={filter} onChange={e=>setFilter(e.target.value)}/></div>}
      <div className="server-list">{profiles.filter(p=>(p.name+' '+p.host).toLowerCase().includes(filter.toLowerCase())).map(p=><button key={p.id} className={`server-row ${current?.profile.id===p.id?'selected':''}`} onClick={()=>connect(p)} onContextMenu={e=>{e.preventDefault();setContext({p,x:Math.min(e.clientX,window.innerWidth-220),y:Math.min(e.clientY,window.innerHeight-170)});}}><Server size={18}/><span><strong>{p.name}</strong><small>{p.username}@{p.host}</small></span>{tabs.some(t=>t.profile.id===p.id&&t.status==='connected')&&<i className="live-dot"/>}</button>)}
      {!profiles.length&&<div className="sidebar-empty">Добавьте свой первый сервер кнопкой ниже.</div>}</div>
      <div className="sidebar-footer"><button className="add-button" onClick={()=>edit(fresh())}><Plus size={19}/><span>Подключение</span></button><span className="local-label" title="Подключения хранятся локально на этом компьютере">Локально</span></div></aside>
      <main className="main"><div className="tabs">{tabs.map(t=><div key={t.id} className={`tab ${active===t.id?'active':''}`}><button className="tab-select" onClick={()=>setActive(t.id)}><i className={`tab-dot ${t.status}`}/><span>{t.profile.name}</span></button><button className="tab-close" title="Закрыть сессию" onClick={()=>closeTab(t)}><X size={14}/></button></div>)}
        {current&&<div className="session-actions"><button className="icon-button" title="Действия с сессией" onClick={e=>{e.stopPropagation();setMenu(!menu);}}><MoreVertical size={18}/></button>{menu&&<div className="dropdown" onClick={e=>e.stopPropagation()}><button onClick={()=>{setCommandsOpen(true);setMenu(false);}}><TerminalIcon size={15}/>Быстрые команды</button><button disabled={current.status!=='connected'} onClick={()=>{setSftpTab(current.id);setMenu(false);}}><FolderOpen size={15}/>Файлы SFTP</button><button disabled={current.status!=='connected'} onClick={()=>{root();setMenu(false);}}><Shield size={15}/>Перейти в root</button><button onClick={()=>{setFind(true);setMenu(false);}}><Search size={15}/>Поиск в терминале</button><button onClick={()=>{connect(current.profile);setMenu(false);}}><Plus size={15}/>Новая сессия</button><button disabled={current.status!=='connected'} onClick={()=>{api?.disconnect(current.id);setMenu(false);}}><PlugZap size={15}/>Отключиться</button>{current.status!=='connected'&&<button onClick={()=>{reconnect(current);setMenu(false);}}>Подключиться снова</button>}</div>}</div>}</div>
      <div className="terminal-content"><div className="terminal-area">{tabs.map(t=><TerminalPane key={t.id} tab={t} active={active===t.id} onFind={()=>setFind(true)} onConfirm={confirm} onFontChange={font}/>)}
      {!tabs.length&&<div className="welcome"><div className="welcome-symbol"><TerminalIcon size={34}/></div><h1>Ваш терминал. Ничего лишнего.</h1><p>Выберите сервер слева или добавьте новое подключение.</p><button className="primary" onClick={()=>edit(fresh())}><Plus size={17}/>Добавить сервер</button><div className="welcome-hint">SSH · Сохранённые пароли · Переход в root</div></div>}
      {current&&current.status==='connecting'&&<div className="connection-banner"><span className="spinner"/>Подключаемся к {current.profile.host}…</div>}
      {current&&['error','disconnected'].includes(current.status)&&<div className="connection-banner disconnected"><span>{current.error||'Соединение закрыто'}</span><button disabled={reconnecting.current.has(current.id)} onClick={()=>reconnect(current)}>Подключиться снова</button></div>}
      {find&&current&&<form className="terminal-search" onSubmit={e=>{e.preventDefault();terminals.get(active)?.search.findNext(query);}}><Search size={15}/><input autoFocus placeholder="Найти в выводе" value={query} onChange={e=>{setQuery(e.target.value);terminals.get(active)?.search.findNext(e.target.value);}}/><button type="button" title="Предыдущее" onClick={()=>terminals.get(active)?.search.findPrevious(query)}>↑</button><button type="submit" title="Следующее">↓</button><button type="button" aria-label="Закрыть поиск" onClick={()=>setFind(false)}><X size={14}/></button></form>}
      </div>{current&&sftpTab===active&&<SftpPane key={current.id} id={current.id} server={current.profile.name} connected={current.status==='connected'} onClose={()=>setSftpTab('')}/>}</div><footer className="statusbar"><span><i className={`status-dot ${current?.status==='connected'?'online':''}`}/>{current?({connected:'Подключено',connecting:'Подключение…',disconnected:'Отключено',error:'Ошибка'}[current.status]||current.status):'Готов к подключению'}</span><div className="status-right">{current&&<><span title={`Получено за сессию: ${volume(current.rx)}. Считаются данные терминала, без накладных расходов SSH.`}><ArrowDown size={13}/>{rate(current.rxRate)}</span><span title={`Отправлено за сессию: ${volume(current.tx)}`}><ArrowUp size={13}/>{rate(current.txRate)}</span><span title="Время установления отдельного TCP-соединения с SSH-портом. Это не ICMP ping; проверка раз в 15 секунд.">TCP {current.latency===null?'—':`${current.latency} ms`}</span></>}</div></footer></main>
    </div>
    {notice&&<div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Закрыть уведомление"><X size={15}/></button></div>}
    {context&&<div className="context-menu" style={{left:context.x,top:context.y}} onClick={e=>e.stopPropagation()}><button onClick={()=>{connect(context.p);setContext(null);}}><TerminalIcon size={15}/>Подключиться</button><button onClick={()=>edit(context.p)}><Pencil size={15}/>Редактировать</button><button onClick={()=>edit({...context.p,id:'',name:context.p.name+' — копия',hasPassword:false,hasPassphrase:false})}><Plus size={15}/>Дублировать</button><button className="danger" onClick={()=>{remove(context.p);setContext(null);}}><Trash2 size={15}/>Удалить</button></div>}
    {editing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}><form className="modal" onSubmit={save}><div className="modal-header"><div><h2>{editing.id?'Настройки подключения':'Новое подключение'}</h2><p>Всё нужное для входа на ваш сервер.</p></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={()=>setEditing(null)}><X size={19}/></button></div>
      <label>Название<input autoFocus required maxLength={255} placeholder="Например, Ubuntu VPS" value={editing.name} onChange={e=>patch({name:e.target.value})}/></label>
      <div className="form-row"><label>Адрес сервера<input required placeholder="IP или домен" value={editing.host} onChange={e=>patch({host:e.target.value})}/></label><label>Пользователь<input required placeholder="alex" value={editing.username} onChange={e=>patch({username:e.target.value})}/></label></div>
      <div className="auth-tabs"><button type="button" className={editing.auth==='password'?'chosen':''} onClick={()=>patch({auth:'password'})}>Пароль</button><button type="button" className={editing.auth==='key'?'chosen':''} onClick={()=>patch({auth:'key'})}><KeyRound size={14}/>SSH-ключ</button></div>
      {editing.auth==='key'&&<><label>Приватный ключ<div className="key-picker"><input readOnly placeholder="Выберите файл OpenSSH / PEM" value={editing.keyPath}/><button type="button" title="Выбрать ключ" onClick={async()=>{const r=await api?.key();if(r?.ok)patch({keyPath:r.value});}}><FolderOpen size={18}/></button></div></label><label>Парольная фраза ключа<input type="password" placeholder={editing.hasPassphrase?'Сохранена · оставьте пустым, чтобы сохранить':'Если ключ защищён'} value={passphrase} onChange={e=>setPassphrase(e.target.value)}/></label></>}
      <label>{editing.auth==='key'?'Пароль пользователя для sudo':'Пароль пользователя'}<div className="password-field"><input type={showPassword?'text':'password'} placeholder={editing.hasPassword?'Сохранён · оставьте пустым, чтобы сохранить':editing.auth==='key'?'Для автоматического перехода в root':'Пароль на сервере'} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" title={showPassword?'Скрыть пароль':'Показать пароль'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
      <div className="toggle-row"><div><strong>Запомнить пароль</strong><small>Защищён средствами Windows</small></div><button type="button" role="switch" aria-checked={editing.remember} aria-label="Запомнить пароль" className={`toggle ${editing.remember?'on':''}`} onClick={()=>patch({remember:!editing.remember})}><span/></button></div>
      <div className="toggle-row"><div><strong>Сразу переходить в root</strong><small>Выполнить sudo -i и передать ваш пароль</small></div><button type="button" role="switch" aria-checked={editing.autoRoot} aria-label="Сразу переходить в root" className={`toggle ${editing.autoRoot?'on':''}`} onClick={()=>patch({autoRoot:!editing.autoRoot})}><span/></button></div>
      <button className="advanced-toggle" type="button" onClick={()=>setAdvanced(!advanced)}><Settings2 size={14}/>Дополнительно <span>{advanced?'−':'+'}</span></button>{advanced&&<label>SSH-порт<input type="number" min="1" max="65535" required value={editing.port} onChange={e=>patch({port:Number(e.target.value)})}/></label>}
      {formError&&<div className="form-error" role="alert">{formError}</div>}<div className="modal-footer"><button className="secondary" type="button" onClick={()=>setEditing(null)}>Отмена</button><button className="primary" type="submit" disabled={saving||!api}>{saving?'Сохраняем…':'Сохранить'}</button></div></form></div>}
    {login&&<div className="modal-backdrop"><form className="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onSubmit={e=>{e.preventDefault();connect(login.profile,{password:loginPassword,passphrase:loginPassphrase,savePassword:loginRemember},login.tabId);}}><div className="modal-header"><div><h2 id="login-title">{login.failed?'Обновить пароль':'Пароль для подключения'}</h2><p>{login.profile.name} · {login.profile.username}@{login.profile.host}</p></div><button type="button" className="icon-button" aria-label="Отмена" onClick={()=>setLogin(null)}><X size={18}/></button></div>{loginError&&<div className="login-explanation">{loginError}</div>}<label>Пароль пользователя<input autoFocus type="password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}/></label>{login.profile.auth==='key'&&<label>Парольная фраза ключа<input type="password" value={loginPassphrase} onChange={e=>setLoginPassphrase(e.target.value)}/></label>}<div className="toggle-row"><div><strong>Сохранить после успешного входа</strong><small>{loginRemember?'Заменит пароль этого сервера':'Использовать только для этой сессии'}</small></div><button type="button" role="switch" aria-label="Сохранить после успешного входа" aria-checked={loginRemember} className={`toggle ${loginRemember?'on':''}`} onClick={()=>setLoginRemember(!loginRemember)}><span/></button></div><div className="modal-footer"><button type="button" className="secondary" onClick={()=>setLogin(null)}>Отмена</button><button className="primary">Подключиться</button></div></form></div>}
    {paletteOpen&&<ServerPalette profiles={profiles} onClose={()=>setPaletteOpen(false)} onConnect={id=>{const p=profiles.find(p=>p.id===id);if(p)connect(p);}}/>}
    {commandsOpen&&<Commands commands={commands} connected={current?.status==='connected'} onSave={saveCommands} onRun={runCommand} onClose={()=>setCommandsOpen(false)}/>}
    {confirmationDialog}
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
