const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {t,setLanguage}=require('../electron/localization.cjs');
const english=require('../locales/en.json');
test('localization preserves interpolated user text and falls back for server messages',()=>{
  setLanguage('en');
  assert.equal(t('Закрыть сессию?'),'Close session?');
  assert.equal(t('Изменить {0}',['Мой сервер $& {1}']),'Edit Мой сервер $& {1}');
  assert.equal(t('Permission denied (publickey)'),'Permission denied (publickey)');
  assert.throws(()=>setLanguage('fr'));
  assert.equal(t('Отмена'),'Cancel');
  setLanguage('ru');assert.equal(t('Отмена'),'Отмена');
});
test('every app translation key has English text with matching placeholders',()=>{
  const ts=require('typescript');
  for(const file of ['src/main.tsx','src/Features.tsx','src/Confirmation.tsx','electron/main.cjs','electron/sftp.cjs','electron/features.cjs','electron/security.cjs']){
    const source=ts.createSourceFile(file,fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.JS);
    function walk(node){
      if(ts.isStringLiteral(node)&&/[А-Яа-яЁё]/.test(node.text)){
        assert.equal(typeof english[node.text],'string',`Missing translation: ${node.text}`);
        assert.ok(!/[А-Яа-яЁё]/.test(english[node.text]),`Untranslated English: ${node.text}`);
        assert.deepEqual(english[node.text].match(/\{\d+\}/g)||[],node.text.match(/\{\d+\}/g)||[]);
      }
      ts.forEachChild(node,walk);
    }walk(source);
  }
});
