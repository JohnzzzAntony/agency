'use strict';
// One-time migration from the existing HTML. Existing content files are never overwritten.
const fs=require('node:fs');
const path=require('node:path');
const {ROOT,files,documentFor}=require('../lib/pages');
const {contentName}=require('../lib/static-content');
const contentDir=path.join(ROOT,'content/pages');
fs.mkdirSync(contentDir,{recursive:true});
let created=0;
for(const file of files){
  const destination=path.join(contentDir,contentName(file));
  if(fs.existsSync(destination))continue;
  const doc=documentFor(file), groups=new Map();
  for(const field of doc.fields){
    if(!groups.has(field.group))groups.set(field.group,{label:field.group,text:[],images:[],details:[],structuredData:[]});
    const kind=field.type==='image'?'images':field.type==='text'?'text':field.type==='json'?'structuredData':'details';
    let value=field.value;
    if(kind==='images'&&!/^https?:\/\//i.test(value))value=new URL(value,'https://local.invalid/'+file).pathname;
    groups.get(field.group)[kind].push({id:field.id,label:field.label,value});
  }
  fs.writeFileSync(destination,JSON.stringify({title:doc.title,path:file,fingerprint:doc.fingerprint,sections:[...groups.values()]},null,2)+'\n',{flag:'wx'});
  created++;
}
console.log('Created '+created+' page records; existing records preserved.');
