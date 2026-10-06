import {t as tr} from './i18n';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ShieldCheck,ShieldAlert,LogOut,Trash2,ClipboardPaste,Terminal,Files,X} from 'lucide-react';
export type ConfirmationOptions={kind?:string;title:string;message:string;acceptLabel:string;cancelLabel?:string;warning?:boolean;address?:string;fingerprint?:string;previousFingerprint?:string;preview?:string};
type Pending=ConfirmationOptions&{id:string;resolve:(value:boolean)=>void};
export function useConfirmation(){
  const [queue,setQueue]=useState<Pending[]>([]);const pending=useRef(new Map<string,(value:boolean)=>void>());
  const confirm=useCallback((options:ConfirmationOptions,id:string=crypto.randomUUID()):Promise<boolean>=>new Promise(resolve=>{
    if(pending.current.has(id)){resolve(false);return;}
    pending.current.set(id,resolve);setQueue(q=>[...q,{...options,id,resolve}]);
  }),[]);
  const settle=useCallback((id:string,value:boolean)=>{const resolve=pending.current.get(id);if(!resolve)return;pending.current.delete(id);setQueue(q=>q.filter(item=>item.id!==id));resolve(value);},[]);
  useEffect(()=>()=>{for(const resolve of pending.current.values())resolve(false);pending.current.clear();},[]);
  return {confirm,dismiss:(id:string)=>settle(id,false),dialog:queue[0]?<ConfirmationDialog key={queue[0].id} options={queue[0]} onAnswer={value=>settle(queue[0].id,value)}/>:null};
}
function ConfirmationDialog({options:o,onAnswer}:{options:ConfirmationOptions;onAnswer:(accepted:boolean)=>void}){
  const ref=useRef<HTMLDivElement>(null);
  const answerRef=useRef(onAnswer);answerRef.current=onAnswer;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    const key=(event:KeyboardEvent)=>{
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();answerRef.current(false);}
      if(event.key==='Tab'){
        const elements=[...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const first=elements[0],last=elements.at(-1)!;
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);previous?.focus();};
  },[]);
  const Icon=o.kind==='host'?(o.warning?ShieldAlert:ShieldCheck):o.kind==='remove'?Trash2:o.kind==='paste'?ClipboardPaste:o.kind==='command'?Terminal:o.kind==='transfer'?Files:LogOut;
  return <div className="modal-backdrop confirmation-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onAnswer(false);}}>
    <div ref={ref} className={`modal confirmation-modal ${o.warning?'confirmation-warning':''}`} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
      <div className="confirmation-top"><div className="confirmation-symbol"><Icon size={23}/></div><button className="icon-button" aria-label={tr("Отмена")} onClick={()=>onAnswer(false)}><X size={18}/></button></div>
      <h2 id="confirmation-title">{o.title}</h2><p id="confirmation-description">{o.message}</p>
      {o.address&&<div className="confirmation-address">{o.address}</div>}
      {o.preview!==undefined&&<div className="command-preview"><span>{tr("Будет отправлено в терминал")}</span><pre>{o.preview}</pre></div>}
      {o.fingerprint&&<div className="fingerprint-block"><span>{tr("Отпечаток ключа сервера")}</span><code>{o.fingerprint}</code>{o.previousFingerprint&&<><span className="previous-label">{tr("Ранее сохранённый")}</span><code className="previous-fingerprint">{o.previousFingerprint}</code></>}</div>}
      <div className="modal-footer"><button data-cancel className="secondary" onClick={()=>onAnswer(false)}>{o.cancelLabel||tr("Отмена")}</button><button className="primary" onClick={()=>onAnswer(true)}>{o.acceptLabel}</button></div>
    </div>
  </div>;
}
