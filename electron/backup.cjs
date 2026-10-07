const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {exportConnections,importConnections}=require('./features.cjs');
const scrypt=promisify(crypto.scrypt);
const FORMAT='amber-ssh-encrypted-connections',MAX_BYTES=2*1024*1024;
const AAD=Buffer.from(FORMAT+':1:scrypt-131072-8-1:aes-256-gcm');
function passwordInput(password,creating=false){
  if(typeof password!=='string'||password.length>1024||!password.length||creating&&password.length<12)throw new Error('Пароль файла должен содержать от 12 до 1024 символов');
}
function secret(value,password=false){
  if(typeof value!=='string'||value.length>16384||value.includes('\0')||password&&/[\r\n]/.test(value))throw new Error('Некорректные учётные данные в файле');
  return value;
}
function payload(profiles){
  const publicData=exportConnections(profiles);importConnections(publicData);
  return {...publicData,profiles:publicData.profiles.map((p,i)=>({...p,password:secret(profiles[i].password||'',true),passphrase:secret(profiles[i].passphrase||'')}))};
}
function validatePayload(raw){
  const profiles=importConnections(raw);
  return profiles.map((p,i)=>({...p,password:secret(raw.profiles[i].password??'',true),passphrase:secret(raw.profiles[i].passphrase??'')}));
}
function bytes(value,size){
  if(typeof value!=='string'||value.length>Math.ceil(MAX_BYTES/3)*4||!value.length||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Неверный формат зашифрованного файла');
  const result=Buffer.from(value,'base64');
  if(result.toString('base64')!==value||size!==undefined&&result.length!==size||result.length>MAX_BYTES)throw new Error('Неверный формат зашифрованного файла');
  return result;
}
function validateEnvelope(raw){
  if(!raw||raw.format!==FORMAT||raw.version!==1||raw.kdf!=='scrypt-131072-8-1'||raw.cipher!=='aes-256-gcm')throw new Error('Неверный формат зашифрованного файла');
  return {salt:bytes(raw.salt,16),iv:bytes(raw.iv,12),tag:bytes(raw.tag,16),data:bytes(raw.data)};
}
async function keyFor(password,salt){return scrypt(password,salt,32,{N:131072,r:8,p:1,maxmem:192*1024*1024});}
async function encryptBackup(profiles,password){
  passwordInput(password,true);
  const plain=Buffer.from(JSON.stringify(payload(profiles)));
  if(plain.length>MAX_BYTES){plain.fill(0);throw new Error('Файл экспорта слишком большой');}
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);let key;
  try{
    key=await keyFor(password,salt);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(AAD);
    const data=Buffer.concat([cipher.update(plain),cipher.final()]);
    return {format:FORMAT,version:1,kdf:'scrypt-131072-8-1',cipher:'aes-256-gcm',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
  }finally{plain.fill(0);key?.fill(0);}
}
async function decryptBackup(raw,password){
  passwordInput(password);const encrypted=validateEnvelope(raw);let key,plain,chunk;
  try{
    key=await keyFor(password,encrypted.salt);const decipher=crypto.createDecipheriv('aes-256-gcm',key,encrypted.iv);decipher.setAAD(AAD);decipher.setAuthTag(encrypted.tag);
    chunk=decipher.update(encrypted.data);plain=Buffer.concat([chunk,decipher.final()]);
    return validatePayload(JSON.parse(plain.toString('utf8')));
  }catch{throw new Error('Неверный пароль файла или файл повреждён');}
  finally{chunk?.fill(0);plain?.fill(0);key?.fill(0);}
}
module.exports={FORMAT,MAX_BYTES,encryptBackup,decryptBackup,validateEnvelope};
