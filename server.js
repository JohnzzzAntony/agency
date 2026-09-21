'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {ROOT,files,documentFor,validate,fingerprints,titles}=require('./lib/pages');
const mime={'.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.avif':'image/avif','.xml':'application/xml','.ico':'image/x-icon','.woff2':'font/woff2'};
function createServer(options={}) {
  const secret=options.secret||process.env.CMS_ADMIN_TOKEN;
  if(!secret || secret.length<32) throw new Error('Set CMS_ADMIN_TOKEN to a random secret of at least 32 characters. See README_CMS.md.');
  const production=options.production??process.env.NODE_ENV==='production';
  const dir=path.resolve(options.dataDir||process.env.CMS_DATA_DIR||path.join(ROOT,'data/runtime'));
  fs.mkdirSync(path.join(dir,'uploads'),{recursive:true});
  const db=path.join(dir,'cms.json');
  let state=fs.existsSync(db)?JSON.parse(fs.readFileSync(db,'utf8')):{pages:{},media:[],inquiries:[]};
  const sessions=new Map(),limits=new Map();
  const fingerprint=file=>fingerprints.get(file);
  function persist(){const tmp=db+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});fs.renameSync(tmp,db);}catch(error){state=fs.existsSync(db)?JSON.parse(fs.readFileSync(db,'utf8')):{pages:{},media:[],inquiries:[]};throw error;}}
  function record(file){return state.pages[file]||{version:0,draft:{},published:{},history:[],fingerprint:fingerprint(file)};}
  function content(file,draft=false){const p=record(file);if(p.fingerprint!==fingerprint(file)) return {};return draft?p.draft:p.published;}
  function fail(status,message){throw Object.assign(new Error(message),{status});}
  function rate(req,kind,max){const key=kind+req.socket.remoteAddress;const now=Date.now();let bucket=limits.get(key);if(!bucket||bucket.until<now) {bucket={count:0,until:now+900000};limits.set(key,bucket);}if(++bucket.count>max) fail(429,'Too many requests. Try again in 15 minutes.');}
  const janitor=setInterval(()=>{const now=Date.now();for(const [key,v] of sessions)if(v.expires<now)sessions.delete(key);for(const [key,v] of limits)if(v.until<now)limits.delete(key);},60000);janitor.unref();
  async function json(req,max=2*1024*1024){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) fail(415,'JSON required');let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)fail(413,'Request too large');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'Invalid JSON');}}
  function auth(req){const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('duoonex_session='));const token=cookie?.slice(16);const session=sessions.get(token);if(!session||session.expires<Date.now())fail(401,'Please sign in');return token;}
  function sameOrigin(req){if(req.headers.origin && req.headers.origin!==`${production?'https':'http'}://${req.headers.host}`)fail(403,'Origin rejected');}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Cache-Control','no-store');
    if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type+(type.startsWith('text/')?'; charset=utf-8':'')});res.end(Buffer.isBuffer(value)?value:type==='application/json'?JSON.stringify(value):value);};
    try {
      const url=new URL(req.url,'http://localhost');
      const pathname=decodeURIComponent(url.pathname);
      const method=req.method;
      if(!['GET','HEAD','POST','PUT','DELETE'].includes(method))fail(405,'Method not allowed');
      if(!['GET','HEAD'].includes(method))sameOrigin(req);
      if(pathname==='/api/health')return send(200,{ok:true});
      if(pathname==='/robots.txt'&&method==='GET')return send(200,'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: '+(production?'https':'http')+'://'+req.headers.host+'/sitemap.xml\n','text/plain');
      if(pathname==='/sitemap.xml'&&method==='GET') {
        const origin=(production?'https':'http')+'://'+req.headers.host;
        const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
        return send(200,'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+files.filter(f=>f!=='CODEINE_Portfolio.html').map(file=>'<url><loc>'+escape(origin+'/'+file.replace(/index\.html$/,''))+'</loc></url>').join('')+'</urlset>','application/xml');
      }
      if(pathname==='/api/login'&&method==='POST') {
        rate(req,'login',20);const input=await json(req,4096);
        const hash=v=>crypto.createHash('sha256').update(v).digest();
        if(typeof input.password!=='string'||!crypto.timingSafeEqual(hash(input.password),hash(secret)))fail(401,'Incorrect admin password');
        const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{expires:Date.now()+8*3600000});
        res.setHeader('Set-Cookie',`duoonex_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${production?'; Secure':''}`);
        return send(200,{ok:true});
      }
      if(pathname==='/api/inquiries'&&method==='POST') {
        rate(req,'inquiry',10);const data=await json(req,20000);
        if(typeof data.name!=='string'||!data.name.trim()||data.name.length>200||typeof data.email!=='string'||!/^\S+@\S+\.\S+$/.test(data.email)||data.email.length>254) fail(400,'Enter your name and valid email');
        const entry={id:crypto.randomUUID(),created:new Date().toISOString()};
        for(const key of ['name','email','message','budget','source','help']) {const v=data[key]||'';if(typeof v!=='string'||v.length>5000)fail(400,'Invalid enquiry');entry[key]=v;}
        if(state.inquiries.length>=10000)fail(503,'Inbox full. Please contact the agency directly.');
        state.inquiries.unshift(entry);persist();return send(201,{ok:true});
      }
      if(pathname.startsWith('/api/')) {
        const token=auth(req);
        if(pathname==='/api/session')return send(200,{ok:true});
        if(pathname==='/api/logout'&&method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','duoonex_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');return send(200,{ok:true});}
        if(pathname==='/api/pages'&&method==='GET')return send(200,files.map(file=>({file,title:record(file).title||titles.get(file),version:record(file).version,changed:JSON.stringify(record(file).draft)!==JSON.stringify(record(file).published)})));
        if(pathname==='/api/page') {
          const file=url.searchParams.get('file');if(!files.includes(file))fail(404,'Page not found');
          const p=record(file);
          if(method==='GET'){const doc=documentFor(file,content(file,true));return send(200,{file,title:doc.title,fields:doc.fields,version:p.version,history:p.history.map((h,i)=>({index:i,date:h.date})),changed:JSON.stringify(p.draft)!==JSON.stringify(p.published),templateChanged:p.fingerprint!==doc.fingerprint});}
          if(method==='PUT') {
            const input=await json(req);if(input.version!==p.version)fail(409,'This page changed in another session. Reload before saving.');
            if(p.fingerprint!==fingerprint(file))fail(409,'Template changed. Export a backup and reset this page before editing.');
            const values=validate(file,input.values);state.pages[file]={...p,draft:values,version:p.version+1};persist();return send(200,{version:p.version+1});
          }
        }
        if(pathname==='/api/publish'&&method==='POST') {
          const input=await json(req);const file=input.file;if(!files.includes(file))fail(404,'Page not found');const p=record(file);
          if(input.version!==p.version)fail(409,'Page changed. Reload before publishing.');
          if(p.fingerprint!==fingerprint(file))fail(409,'Template changed. Reset page first.');
          state.pages[file]={...p,title:documentFor(file,p.draft).title,published:{...p.draft},history:[{date:new Date().toISOString(),values:p.published},...p.history].slice(0,20),version:p.version+1};persist();return send(200,{ok:true});
        }
        if(pathname==='/api/restore'&&method==='POST') {
          const input=await json(req);if(!files.includes(input.file))fail(404,'Page not found');const p=record(input.file);
          if(input.version!==p.version)fail(409,'Page changed. Reload first.');
          const templateChanged=p.fingerprint!==fingerprint(input.file);
          if(templateChanged&&input.index!=='original')fail(409,'Template changed. Restore original content before editing.');
          const draft=input.index==='original'?{}:p.history[input.index]?.values;
          if(!draft)fail(400,'Revision not found');
          state.pages[input.file]={...p,...(templateChanged?{published:{},history:[],title:titles.get(input.file)}:{}),draft:validate(input.file,draft),fingerprint:fingerprint(input.file),version:p.version+1};persist();return send(200,{ok:true});
        }
        if(pathname==='/api/media'&&method==='GET')return send(200,[...state.media,...fs.readdirSync(path.join(ROOT,'assets/images')).filter(n=>/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(n)).map(name=>({name,url:'/assets/images/'+name}))]);
        if(pathname==='/api/media'&&method==='POST') {
          const input=await json(req,12*1024*1024);if(typeof input.base64!=='string'||!input.base64.match(/^[A-Za-z0-9+/]*={0,2}$/))fail(400,'Invalid image');
          const bytes=Buffer.from(input.base64,'base64');if(bytes.length>8*1024*1024||bytes.length<12)fail(400,'Image must be smaller than 8 MB');
          let ext;if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))ext='png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';else if(/^GIF8[79]a/.test(bytes.toString('ascii',0,6)))ext='gif';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';
          if(!ext)fail(400,'Upload PNG, JPEG, WebP or GIF images');
          const name=crypto.randomUUID()+'.'+ext;fs.writeFileSync(path.join(dir,'uploads',name),bytes,{flag:'wx'});
          const item={name:String(input.name||name).slice(0,200),url:'/media/'+name};state.media.unshift(item);persist();return send(201,item);
        }
        if(pathname==='/api/inquiries'&&method==='GET')return send(200,state.inquiries);
        if(pathname==='/api/inquiries'&&method==='DELETE'){const input=await json(req);state.inquiries=state.inquiries.filter(i=>i.id!==input.id);persist();return send(200,{ok:true});}
        if(pathname==='/api/backup'&&method==='GET'){res.setHeader('Content-Disposition','attachment; filename="duoonex-content-backup.json"');return send(200,state);}
        fail(404,'Endpoint not found');
      }
      if(method!=='GET'&&method!=='HEAD')fail(405,'Method not allowed');
      if(pathname==='/admin'){res.writeHead(302,{Location:'/admin/'});return res.end();}
      if(pathname==='/admin/'||pathname==='/admin/index.html')return send(200,fs.readFileSync(path.join(ROOT,'admin/index.html')),'text/html');
      let file=pathname.replace(/^\//,'');if(!file||file.endsWith('/'))file+='index.html';
      if(files.includes(file)) {
        const preview=url.searchParams.has('preview');if(preview)auth(req);
        const doc=documentFor(file,content(file,preview),preview);
        return send(200,doc.html,'text/html');
      }
      if(files.includes(file+'/index.html')){res.writeHead(302,{Location:pathname+'/'});return res.end();}
      let target;
      if(/^\/media\/[a-f0-9-]+\.(png|jpg|webp|gif)$/.test(pathname)) target=path.join(dir,'uploads',path.basename(pathname));
      else if(/^(assets\/(css|js|images)\/|admin\/(admin\.js|admin\.css|preview\.js)$)/.test(file)&&!file.split('/').some(s=>s==='..'||s.startsWith('.'))&&!file.includes('\\'))target=path.resolve(ROOT,file);
      if(!target||!fs.existsSync(target)||!fs.statSync(target).isFile())fail(404,'Not found');
      const type=mime[path.extname(target).toLowerCase()];if(!type)fail(404,'Not found');
      return send(200,fs.readFileSync(target),type);
    } catch(error) {send(error.status||400,{error:error.status?error.message:'Invalid request: '+error.message});}
  });
  server.on('close',()=>clearInterval(janitor));
  return server;
}
if(require.main===module)createServer().listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('DuooNex website and admin ready on port '+(process.env.PORT||3000)));
module.exports={createServer};
