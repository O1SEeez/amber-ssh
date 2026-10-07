import {useEffect,useRef,useState} from 'react';
import {LockKeyhole,X} from 'lucide-react';
import {t as tr} from './i18n';
export type BackupPasswordOptions={mode:'export'|'import';submit:(password:string)=>Promise<string|undefined>;cancel:()=>void};
export function BackupPassword({options:o}:{options:BackupPasswordOptions}){
  const [password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const ref=useRef<HTMLDivElement>(null),busyRef=useRef(false),cancelRef=useRef(o.cancel);cancelRef.current=o.cancel;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector('input')?.focus();
    const key=(e:KeyboardEvent)=>{
      e.stopPropagation();if(e.key==='Escape'){e.preventDefault();if(!busyRef.current)cancelRef.current();}
      if(e.key==='Tab'){
        const elements=[...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')],first=elements[0],last=elements.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);previous?.focus();};
  },[]);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(busyRef.current)return;
    if(o.mode==='export'&&password!==repeat){setError(tr('Пароли не совпадают'));return;}
    busyRef.current=true;setBusy(true);setError('');
    try{const failure=await o.submit(password);if(failure)setError(failure);}catch{setError(tr('Не удалось обработать файл'));}
    finally{busyRef.current=false;setBusy(false);}
  }
  return <div className="modal-backdrop confirmation-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)o.cancel();}}>
    <div ref={ref} className="modal confirmation-modal backup-modal" role="dialog" aria-modal="true" aria-labelledby="backup-title" aria-describedby="backup-hint">
      <div className="confirmation-top"><div className="confirmation-symbol"><LockKeyhole size={23}/></div><button className="icon-button" disabled={busy} aria-label={tr('Отмена')} onClick={o.cancel}><X size={18}/></button></div>
      <h2 id="backup-title">{tr(o.mode==='export'?'Экспорт с паролями':'Открыть зашифрованный файл')}</h2>
      <p id="backup-hint">{tr(o.mode==='export'?'Сохранённые пароли и секретные фразы ключей будут зашифрованы. SSH-ключи и временные пароли не включаются. Пароль файла восстановить нельзя.':'Введите пароль, заданный при экспорте. Сохранённые пароли будут зашифрованы заново средствами этого компьютера. SSH-ключи нужно выбрать отдельно.')}</p>
      <form onSubmit={submit}>
        <label>{tr('Пароль файла')}<input type="password" aria-label={tr('Пароль файла')} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="off" minLength={o.mode==='export'?12:1} maxLength={1024} required disabled={busy}/></label>
        {o.mode==='export'&&<><p className="feature-hint">{tr('Не менее 12 символов. Используйте длинный уникальный пароль.')}</p><label>{tr('Повторите пароль файла')}<input type="password" aria-label={tr('Повторите пароль файла')} value={repeat} onChange={e=>setRepeat(e.target.value)} autoComplete="off" maxLength={1024} required disabled={busy}/></label></>}
        {error&&<p className="sftp-error" role="alert">{error}</p>}
        <div className="modal-footer"><button type="button" className="secondary" disabled={busy} onClick={o.cancel}>{tr('Отмена')}</button><button type="submit" className="primary" disabled={busy}>{tr(busy?'Обработка…':o.mode==='export'?'Экспортировать':'Открыть')}</button></div>
      </form>
    </div>
  </div>;
}
