const {randomUUID}=require('node:crypto');
class Confirmations {
  constructor(send,timeout=120000){this.send=send;this.timeout=timeout;this.pending=new Map();}
  request(details){return new Promise(resolve=>{
    const requestId=randomUUID();const timer=setTimeout(()=>this.answer(requestId,false),this.timeout);timer.unref?.();
    this.pending.set(requestId,{resolve,timer,sessionId:details.sessionId});
    this.send({type:'confirmation',requestId,...details});
  });}
  answer(id,accepted){const item=this.pending.get(id);if(!item)return false;this.pending.delete(id);clearTimeout(item.timer);item.resolve(accepted===true);this.send({type:'confirmation-dismissed',requestId:id});return true;}
  cancelSession(id){for(const [key,item] of this.pending)if(item.sessionId===id)this.answer(key,false);}
  cancelAll(){for(const key of this.pending.keys())this.answer(key,false);}
}
module.exports={Confirmations};
