'use strict';
// Optional development-only static file preview. No login, database or write endpoints.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {ROOT}=require('../lib/pages');
const root=path.join(ROOT,'dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.avif':'image/avif','.xml':'application/xml','.txt':'text/plain'};
function createPreview(){
  return http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      let target=path.resolve(root,'.'+pathname);
      if((target!==root&&!target.startsWith(root+path.sep))||pathname.includes('\\')||pathname.split('/').some(v=>v.startsWith('.'))){res.writeHead(404);return res.end();}
      if(fs.existsSync(target)&&fs.statSync(target).isDirectory()){
        if(!pathname.endsWith('/')){res.writeHead(302,{Location:pathname+'/'});return res.end();}
        target=path.join(target,'index.html');
      }
      if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end('Not found. Run npm run build first.');}
      res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});
      res.end(req.method==='HEAD'?undefined:fs.readFileSync(target));
    }catch{res.writeHead(400);res.end('Invalid request');}
  });
}
if(require.main===module)createPreview().listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Static preview: http://127.0.0.1:'+(process.env.PORT||3000)));
module.exports={createPreview};
