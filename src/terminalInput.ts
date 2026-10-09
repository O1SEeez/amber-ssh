// Reserve the input stream before asynchronous clipboard reads. Keystrokes that
// follow Ctrl+V must reach the shell after the pasted text, in their original order.
export function createTerminalInput(send:(data:string)=>void){
  let pending=false,disposed=false,insidePaste=false;
  let keys:string[]=[];
  return {
    write(data:string){if(disposed)return;if(pending&&!insidePaste)keys.push(data);else send(data);},
    async paste(read:()=>Promise<string>,apply:(text:string)=>Promise<boolean>){
      if(disposed||pending)return;
      pending=true;let accepted=false;
      try{const text=await read();if(disposed)return;accepted=await apply(text);}finally{
        pending=false;const queued=keys;keys=[];
        if(accepted&&!disposed)for(const key of queued)send(key);
      }
    },
    insert(action:()=>void){if(disposed)return;insidePaste=true;try{action();}finally{insidePaste=false;}},
    dispose(){disposed=true;keys=[];}
  };
}
