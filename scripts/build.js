'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {ROOT,files}=require('../lib/pages');
const {contentName,renderPage,validateSettings}=require('../lib/static-content');
function build(options={}){
  const output=path.resolve(ROOT,'dist');
  // Deletion is restricted to this project's generated output directory.
  if(output!==path.join(ROOT,'dist')||fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw new Error('Unsafe output directory');
  const settings=validateSettings({...JSON.parse(fs.readFileSync(path.join(ROOT,'content/settings.json'),'utf8')), ...(options.siteUrl?{siteUrl:options.siteUrl}:{})});
  const rendered=[];
  for(const file of files){
    const data=JSON.parse(fs.readFileSync(path.join(ROOT,'content/pages',contentName(file)),'utf8'));
    rendered.push([file,renderPage(file,data,settings)]);
  }
  fs.rmSync(output,{force:true,recursive:true});
  fs.mkdirSync(output,{recursive:true});
  for(const [file,html] of rendered){const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);}
  fs.cpSync(path.join(ROOT,'assets'),path.join(output,'assets'),{recursive:true});
  fs.cpSync(path.join(ROOT,'admin'),path.join(output,'admin'),{recursive:true});
  fs.writeFileSync(path.join(output,'.nojekyll'),'');
  let robots='User-agent: *\nAllow: /\nDisallow: /admin/\n';
  if(settings.siteUrl){
    const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
    const urls=files.filter(f=>f!=='CODEINE_Portfolio.html').map(f=>new URL(f.replace(/index\.html$/,''),settings.siteUrl.replace(/\/$/,'')+'/').href);
    fs.writeFileSync(path.join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+escape(url)+'</loc></url>').join('')+'</urlset>');
    robots+='Sitemap: '+settings.siteUrl.replace(/\/$/,'')+'/sitemap.xml\n';
  }
  fs.writeFileSync(path.join(output,'robots.txt'),robots);
  console.log('Built '+rendered.length+' pages into dist/. No application server required.');
  return output;
}
if(require.main===module)build({siteUrl:process.env.SITE_URL});
module.exports={build};
