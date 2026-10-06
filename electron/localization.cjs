const english=require('../locales/en.json');
let language='ru';
function setLanguage(value){
  if(value!=='ru'&&value!=='en')throw new Error('Unsupported interface language');
  language=value;
}
function t(source,parameters=[]){
  const translated=language==='en'?english[source]??source:source;
  return translated.replace(/\{(\d+)\}/g,(placeholder,index)=>Number(index)<parameters.length?String(parameters[Number(index)]):placeholder);
}
module.exports={t,setLanguage};
