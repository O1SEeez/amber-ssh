const test=require('node:test');const assert=require('node:assert/strict');const {Confirmations}=require('../electron/confirmations.cjs');
test('only explicit true accepts a request and responses can be used once',async()=>{
  const events=[];const c=new Confirmations(e=>events.push(e));const decision=c.request({kind:'host'});const id=events[0].requestId;
  assert.equal(c.answer('unknown',true),false);assert.equal(c.answer(id,'true'),true);assert.equal(await decision,false);assert.equal(c.answer(id,true),false);
  const accepted=c.request({kind:'host'});c.answer(events.at(-1).requestId,true);assert.equal(await accepted,true);
});
test('closing one session cancels its trust request without approving another',async()=>{
  const events=[];const c=new Confirmations(e=>events.push(e));const a=c.request({sessionId:'a'}),b=c.request({sessionId:'b'});
  const bId=events[1].requestId;c.cancelSession('a');assert.equal(await a,false);assert.equal(c.pending.size,1);c.answer(bId,true);assert.equal(await b,true);
});
test('unanswered requests expire as a rejection',async()=>{
  const c=new Confirmations(()=>{},10);const keepAlive=setTimeout(()=>{},100);assert.equal(await c.request({kind:'host'}),false);clearTimeout(keepAlive);assert.equal(c.pending.size,0);
});
