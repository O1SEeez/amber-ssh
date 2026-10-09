import {useEffect,useState} from 'react';
import {Download,RefreshCw} from 'lucide-react';
import {t as tr} from './i18n';
export type UpdateState={phase:string;currentVersion:string;version:string;percent:number;error?:string};
const initial:UpdateState={phase:'idle',currentVersion:'',version:'',percent:0};
export function Updates({onNotice}:{onNotice:(message:string)=>void}){
  const [state,setState]=useState(initial);
  useEffect(()=>{
    let live=true;
    const stop=window.amber?.onEvent(event=>{if(event.type==='update'&&event.update)setState(event.update);});
    window.amber?.updateState().then(result=>{if(live&&result.ok)setState(result.value);});
    return()=>{live=false;stop?.();};
  },[]);
  async function action(){
    const api=window.amber;if(!api)return;
    if(state.phase==='unsupported'){await api.updateRelease();return;}
    const result=await (state.phase==='ready'?api.updateInstall():state.phase==='available'?api.updateDownload():api.updateCheck());
    if(!result.ok)onNotice(result.error||tr('Не удалось проверить обновления. Проверьте интернет и попробуйте снова.'));
  }
  const busy=['checking','downloading','installing'].includes(state.phase);
  const title=state.phase==='unsupported'?tr('Автообновление Windows доступно в установленной версии. Скачать установщик.'):
    state.phase==='error'?tr(state.error||'Не удалось проверить обновления. Проверьте интернет и попробуйте снова.'):tr('Проверить обновления');
  const label=state.phase==='unsupported'?tr('Установить версию с обновлениями'):state.phase==='available'?tr('Обновить до {0}',[state.version]):state.phase==='ready'?tr('Перезапустить и обновить'):
    state.phase==='downloading'?tr('Загрузка {0}%',[state.percent]):state.phase==='installing'?tr('Установка…'):
    state.phase==='checking'?tr('Проверяем…'):state.phase==='current'?tr('Установлена последняя версия'):
    state.phase==='error'?tr('Повторить проверку'):tr('Проверить обновления');
  return <button className={`update-control ${['available','ready','error'].includes(state.phase)?'update-visible':''}`} title={title} aria-label={label} disabled={busy} onClick={()=>void action()}>
    {state.phase==='ready'?<RefreshCw size={13}/>:<Download size={13}/>}<span>{label}</span>
  </button>;
}
