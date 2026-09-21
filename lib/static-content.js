'use strict';
const path=require('node:path');
const cheerio=require('cheerio');
const {documentFor,validate}=require('./pages');
const contentName=file=>file.replace(/\.html$/,'').replaceAll('/','--')+'.json';
function valuesFor(file,record){
  const doc=documentFor(file);
  if(record.path!==file||record.fingerprint!==doc.fingerprint)throw new Error(file+': source template changed; migrate its content mapping before building.');
  const values={},seen=new Set();
  if(!Array.isArray(record.sections))throw new Error(file+': sections are missing');
  for(const section of record.sections){
    for(const kind of ['text','images','details','structuredData']){
      const items=section[kind]??[];
      if(!Array.isArray(items))throw new Error(file+': invalid '+kind+' fields');
      for(const field of items){
        if(!field||typeof field.id!=='string'||seen.has(field.id))throw new Error(file+': duplicate or missing field ID');
        seen.add(field.id);values[field.id]=field.value==null?'':field.value;
      }
    }
  }
  if(seen.size!==doc.fields.length||doc.fields.some(f=>!seen.has(f.id)))throw new Error(file+': fields were added or removed; restore the existing field list in the CMS.');
  return validate(file,values);
}
function localRelative(value,file){
  if(!value?.startsWith('/')||value.startsWith('//'))return value;
  const url=new URL(value,'https://local.invalid');
  const relative=path.posix.relative(path.posix.dirname(file),decodeURI(url.pathname).replace(/^\//,''));
  return (relative||'./')+url.search+url.hash;
}
function renderPage(file,record,settings={}){
  const values=valuesFor(file,record);
  const $=cheerio.load(documentFor(file,values).html);
  $('[href],[src]').each((_,el)=>{for(const key of ['href','src'])if($(el).attr(key))$(el).attr(key,localRelative($(el).attr(key),file));});
  $('[style]').each((_,el)=>{
    $(el).attr('style',$(el).attr('style').replace(/url\((["']?)(\/[^"')]+)\1\)/g,(_,quote,value)=>'url("'+localRelative(value,file)+'")'));
  });
  $('[data-cms]').removeAttr('data-cms');
  $('[data-contact-form]').each((_,el)=>{
    $(el).attr('data-contact-email',settings.contactEmail||'johnsantonyjo@gmail.com');
    if(settings.formEndpoint)$(el).attr('data-form-endpoint',settings.formEndpoint);
  });
  if(settings.siteUrl){
    const url=new URL(file.replace(/index\.html$/,''),settings.siteUrl.replace(/\/$/,'')+'/').href;
    if(!$('link[rel="canonical"]').length)$('head').append('<link rel="canonical">');
    $('link[rel="canonical"]').attr('href',url);
    if(!$('meta[property="og:url"]').length)$('head').append('<meta property="og:url">');
    $('meta[property="og:url"]').attr('content',url);
  }
  return $.html();
}
function validateSettings(settings){
  if(typeof settings.contactEmail!=='string'||!/^\S+@\S+\.\S+$/.test(settings.contactEmail)||/[\r\n]/.test(settings.contactEmail))throw new Error('Set a valid contact email');
  for(const key of ['siteUrl','formEndpoint'])if(settings[key]){
    const url=new URL(settings[key]);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error(key+' must be an HTTPS URL without credentials, query or fragment');
  }
  return settings;
}
module.exports={contentName,valuesFor,renderPage,validateSettings,localRelative};
