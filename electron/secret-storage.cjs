function createSecretStorage(storage,platform,translate=value=>value){
  function available(){
    if(!storage.isEncryptionAvailable())return false;
    if(platform!=='linux')return true;
    return ['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(storage.getSelectedStorageBackend?.());
  }
  function requireStorage(){
    if(!available())throw new Error(translate('Защищённое хранилище паролей недоступно. В Linux разблокируйте GNOME Keyring или KWallet. Можно подключиться без сохранения пароля.'));
  }
  return {
    encrypt(value){requireStorage();return storage.encryptString(value).toString('base64');},
    decrypt(value){if(!value)return '';requireStorage();return storage.decryptString(Buffer.from(value,'base64'));},
    available
  };
}
module.exports={createSecretStorage};
