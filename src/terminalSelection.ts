import type {Terminal} from '@xterm/xterm';

// xterm already scrolls and extends a drag selection outside its screen.
// Treat the last/first 24 pixels as that boundary as well, so the pointer
// can stay inside the window. Let xterm retain the anchor and selection mode.
export function enableSelectionEdgeScroll(container:HTMLElement,terminal:Terminal){
  const screen=container.querySelector<HTMLElement>('.xterm-screen');
  if(!screen)return ()=>{};
  const document=container.ownerDocument,window=document.defaultView!;
  let dragging=false;
  const forwarded=new WeakSet<MouseEvent>();
  const stop=()=>{dragging=false;};
  const down=(event:MouseEvent)=>{
    dragging=event.button===0&&screen.contains(event.target as Node)&&
      (terminal.modes.mouseTrackingMode==='none'||event.shiftKey);
  };
  const move=(event:MouseEvent)=>{
    if(forwarded.has(event)||!dragging)return;
    if(!(event.buttons&1)){stop();return;}
    const bounds=screen.getBoundingClientRect();
    if(!bounds.height||document.querySelector('[aria-modal="true"]')){stop();return;}
    const edge=Math.min(24,bounds.height/4);
    let y:number;
    if(event.clientY>=bounds.top&&event.clientY<bounds.top+edge)y=bounds.top-1-(bounds.top+edge-event.clientY);
    else if(event.clientY<=bounds.bottom&&event.clientY>bounds.bottom-edge)y=bounds.bottom+1+(event.clientY-(bounds.bottom-edge));
    else return;
    const translated=new MouseEvent('mousemove',{bubbles:true,cancelable:true,view:window,
      clientX:event.clientX,clientY:y,buttons:event.buttons,button:event.button,
      shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey});
    forwarded.add(translated);
    event.stopImmediatePropagation();
    document.dispatchEvent(translated);
  };
  const blur=()=>{if(dragging){stop();document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));}};
  screen.addEventListener('mousedown',down,true);
  document.addEventListener('mousemove',move,true);
  document.addEventListener('mouseup',stop,true);
  window.addEventListener('blur',blur);
  return ()=>{screen.removeEventListener('mousedown',down,true);document.removeEventListener('mousemove',move,true);document.removeEventListener('mouseup',stop,true);window.removeEventListener('blur',blur);};
}
