const test=require('node:test'),assert=require('node:assert/strict');
const policy=import('../src/paste.ts');
test('paste confirmation starts at four explicit lines, including empty lines',async()=>{
  const {pasteNeedsConfirmation}=await policy;
  for(const separator of ['\n','\r\n','\r']){
    assert.equal(pasteNeedsConfirmation(['one','two','three'].join(separator)),false);
    assert.equal(pasteNeedsConfirmation(['one','two','three'].join(separator)+separator),false);
    assert.equal(pasteNeedsConfirmation(['one','two','three','four'].join(separator)),true);
    assert.equal(pasteNeedsConfirmation(['one','two','three','four'].join(separator)+separator),true);
  }
  assert.equal(pasteNeedsConfirmation('one\n\n\nthree'),true);
  assert.equal(pasteNeedsConfirmation(''),false);
  assert.equal(pasteNeedsConfirmation('x'.repeat(19000)),false);
});
