const test=require('node:test'),assert=require('node:assert/strict');
const {createSecretStorage}=require('../electron/secret-storage.cjs');
test('Linux refuses basic_text and unavailable keyrings without invoking encryption',()=>{
  for(const backend of ['basic_text','unknown',undefined]){
    const storage=createSecretStorage({isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=>backend,encryptString:()=>assert.fail('insecure encryption invoked'),decryptString:()=>assert.fail('insecure decryption invoked')},'linux');
    assert.equal(storage.available(),false);assert.throws(()=>storage.encrypt('secret'));assert.throws(()=>storage.decrypt('YQ=='));assert.equal(storage.decrypt(''),'');
  }
  assert.equal(createSecretStorage({isEncryptionAvailable:()=>false},'win32').available(),false);
});
test('supported keyrings and Windows retain encrypted roundtrip',()=>{
  for(const [platform,backend] of [['win32',undefined],...['gnome_libsecret','kwallet','kwallet5','kwallet6'].map(backend=>['linux',backend])]){
    const storage=createSecretStorage({isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=>backend,encryptString:value=>Buffer.from('encrypted:'+value),decryptString:value=>value.toString().slice(10)},platform);
    assert.equal(storage.available(),true);assert.equal(storage.decrypt(storage.encrypt('test password')),'test password');
  }
});
