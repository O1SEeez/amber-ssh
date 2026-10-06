import {useSyncExternalStore} from 'react';
import english from '../locales/en.json';
export type Language='ru'|'en';
let language:Language='ru';
const listeners=new Set<()=>void>();
const originals=new Map(Object.entries(english).map(([source,translated])=>[translated,source]));
export function setLanguage(value:Language){
  language=value;document.documentElement.lang=value;
  for(const listener of listeners)listener();
}
export function useLanguage(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>language);}
export function t(source:string,parameters:unknown[]=[]):string {
  const original=originals.get(source)??source;
  const translated=language==='en'?(english as Record<string,string>)[original]??original:original;
  return translated.replace(/\{(\d+)\}/g,(placeholder,index)=>Number(index)<parameters.length?String(parameters[Number(index)]):placeholder);
}
