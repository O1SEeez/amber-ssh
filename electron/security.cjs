const crypto = require('node:crypto');
function validateProfile(p) {
  if (!p || typeof p !== 'object') throw new Error('Некорректное подключение');
  for (const field of ['name','host','username']) {
    if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > 255 || /[\x00-\x1f]/.test(p[field])) throw new Error('Заполните название, адрес и пользователя');
  }
  const port = Number(p.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Порт должен быть от 1 до 65535');
  if (!['password','key'].includes(p.auth)) throw new Error('Неизвестный способ входа');
  if (p.auth === 'key' && (!p.keyPath || typeof p.keyPath !== 'string')) throw new Error('Выберите приватный ключ');
  return { id: typeof p.id === 'string' && /^[\w-]{1,80}$/.test(p.id) ? p.id : crypto.randomUUID(), name:p.name.trim(), host:p.host.trim(), username:p.username.trim(), port, auth:p.auth, keyPath:p.auth==='key'?p.keyPath:'', remember:!!p.remember, autoRoot:!!p.autoRoot };
}
function rootCommand(token) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Invalid token');
  return `sudo -p '[amber:${token}]' -i\r`;
}
function fingerprint(key) { return 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/,''); }
function isSudoPrompt(buffer,marker) { return buffer === marker || buffer.endsWith('\n'+marker) || buffer.endsWith('\r'+marker); }
function createOutputFilter(replacements) {
  let pending='';
  return {push(text){
    pending+=text;let output='';
    while(pending){
      const complete=replacements.find(([source])=>pending.startsWith(source));
      if(complete){output+=complete[1];pending=pending.slice(complete[0].length);continue;}
      if(replacements.some(([source])=>source.startsWith(pending)))break;
      output+=pending[0];pending=pending.slice(1);
    }
    return output;
  },flush(){const result=pending;pending='';return result;}};
}
module.exports = {validateProfile, rootCommand, fingerprint, isSudoPrompt, createOutputFilter};
