const test=require('node:test'),assert=require('node:assert/strict');
const {createTerminalSize}=require('../electron/terminal-size.cjs');
test('PTY gets the fitted dimensions after delayed authentication, including very narrow windows',()=>{
 const size=createTerminalSize({cols:110,rows:32});size.update(103,30);
 assert.deepEqual(size.snapshot(),{cols:103,rows:30});size.update(12,3);
 assert.deepEqual(size.snapshot(),{cols:12,rows:3});
});
test('resize during shell creation is applied on attach, without duplicate window changes',()=>{
 const size=createTerminalSize({cols:110,rows:32}),requested=size.snapshot(),calls=[];
 size.update(103,30);size.update(77,25);size.attach({setWindow:(...args)=>calls.push(args)},requested);
 assert.deepEqual(calls,[[25,77,0,0]]);size.update(77,25);assert.equal(calls.length,1);
 size.update(80,24);assert.deepEqual(calls.at(-1),[24,80,0,0]);
 for(const [cols,rows] of [[0,24],[80,0],[NaN,24],[80,Infinity],[1001,24],[80,501],[80.5,24]])size.update(cols,rows);
 assert.deepEqual(size.snapshot(),{cols:80,rows:24});assert.equal(calls.length,2);
});
test('slow clipboard read preserves paste, arrow and typed character order',async()=>{
 const {createTerminalInput}=await import('../src/terminalInput.ts');const sent=[];const input=createTerminalInput(data=>sent.push(data));let resolve;
 const pending=input.paste(()=>new Promise(r=>resolve=r),async text=>{input.insert(()=>input.write('\x1b[200~'+text+'\x1b[201~'));return true;});
 input.write('\x1b[D');input.write('X');assert.deepEqual(sent,[]);resolve('long command');await pending;
 assert.deepEqual(sent,['\x1b[200~long command\x1b[201~','\x1b[D','X']);
});
test('canceling paste or closing its tab never leaks queued input into a shell',async()=>{
 const {createTerminalInput}=await import('../src/terminalInput.ts');const sent=[],input=createTerminalInput(data=>sent.push(data));
 let resolve;const canceled=input.paste(()=>new Promise(r=>resolve=r),async()=>false);input.write('\r');resolve('unsafe');await canceled;assert.deepEqual(sent,[]);
 const closed=input.paste(()=>new Promise(r=>resolve=r),async text=>{input.insert(()=>input.write(text));return true;});input.write('x');input.dispose();resolve('late');await closed;assert.deepEqual(sent,[]);
});
