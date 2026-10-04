'use strict';
// Create a clean deployable Node application. No credentials or runtime data are included.
const fs=require('fs'),path=require('path');
require('./verify.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw new Error('Unexpected build path');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const dirs=['about','admin','assets','blog','case-studies','contact','faqs','lib','llm-info','locations','privacy-policy','services','startups','subscription','terms-conditions','testimonials'];
for(const dir of dirs)fs.cpSync(path.join(root,dir),path.join(out,dir),{recursive:true,filter:source=>!(/assets[\\/]images[\\/]projects[\\/].*\.png$/.test(source))});
for(const file of ['index.html','CODEINE_Portfolio.html','server.js','package.json','package-lock.json','Dockerfile','.dockerignore','.env.example','README_CMS.md','FINAL_BUILD.md','sitemap.xml','robots.txt','llms.txt'])fs.copyFileSync(path.join(root,file),path.join(out,file));
fs.mkdirSync(path.join(out,'data'),{recursive:true});
for(const file of ['projects.json','project-redirects.json'])fs.copyFileSync(path.join(root,'data',file),path.join(out,'data',file));
fs.cpSync(path.join(root,'test'),path.join(out,'test'),{recursive:true});
fs.mkdirSync(path.join(out,'tools'));
for(const file of ['verify.cjs','build.cjs'])fs.copyFileSync(path.join(root,'tools',file),path.join(out,'tools',file));
console.log('Production package ready: '+out+' (npm ci --omit=dev, configure environment, npm start).');
