const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('../server');
const {files,documentFor,validate}=require('../lib/pages');
const cheerio=require('cheerio');
const secret='test-only-password-12345678901234567890';
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
test('Every existing page exposes text, images, SEO and preserved structure',()=>{
  assert.ok(files.length>60);
  for(const file of files){
    const doc=documentFor(file),$=cheerio.load(doc.html);
    assert.ok(doc.fields.some(f=>f.type==='text'),file);
    assert.ok(doc.fields.some(f=>f.type==='image'),file);
    assert.ok(doc.fields.some(f=>f.group==='SEO'),file);
    assert.deepEqual(validate(file,Object.fromEntries(doc.fields.map(f=>[f.id,f.value]))),{});
    const original=cheerio.load(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
    assert.equal($('section').length,original('section').length);
    assert.equal($('a').length,original('a').length);
    assert.equal($('svg').length,original('svg').length);
    assert.equal($('h1').html(),original('h1').html());
    assert.equal($('script[src$="cms.js"]').length,0);
  }
});
test('Drafts, publishing, authentication, media, persistence and enquiries',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'duoonex-test-'));
  let server=createServer({secret,dataDir:dir,production:false});let base=await listen(server),cookie='';
  const request=(url,method='GET',data,authenticated=true)=>fetch(base+url,{method,headers:{'Content-Type':'application/json',...(authenticated&&cookie?{cookie}: {})},body:data===undefined?undefined:JSON.stringify(data)});
  try {
    assert.equal((await request('/api/page?file=index.html')).status,401);
    assert.equal((await request('/api/content','PUT',{})).status,401);
    assert.equal((await request('/index.html?preview=1')).status,401);
    for(const file of ['/server.js','/.git/config','/package.json','/data/runtime/cms.json','/lib/pages.js','/assets/../server.js','/assets/css/../../server.js'])assert.equal((await request(file)).status,404,file);
    assert.equal((await request('/api/login','POST',{password:'incorrect'})).status,401);
    const login=await request('/api/login','POST',{password:secret});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);
    const list=await (await request('/api/pages')).json();assert.equal(list.length,files.length);
    const page=await (await request('/api/page?file=index.html')).json();
    const field=page.fields.find(f=>f.label.startsWith('h1 ·'));
    const title=page.fields.find(f=>f.label.startsWith('title ·'));
    const photo=page.fields.find(f=>f.type==='image'&&f.label.includes('Background'));
    assert.ok(photo);const values={[field.id]:'Custom test heading <script>alert(1)</script>',[title.id]:'New SEO title'};
    const saved=await request('/api/page?file=index.html','PUT',{version:page.version,values});assert.equal(saved.status,200);const v=(await saved.json()).version;
    assert.equal((await request('/api/page?file=index.html','PUT',{version:0,values})).status,409);
    assert.doesNotMatch(await (await request('/')).text(),/Custom test heading/);
    const preview=await (await request('/index.html?preview=1')).text();assert.match(preview,/Custom test heading &lt;script&gt;/);assert.match(preview,/grad-warm/);assert.match(preview,/admin\/preview.js/);
    assert.equal((await request('/api/publish','POST',{file:'index.html',version:v})).status,200);
    assert.match(await (await request('/')).text(),/<title>New SEO title<\/title>/);
    const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=';
    assert.equal((await request('/api/media','POST',{name:'bad.svg',base64:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')})).status,400);
    const upload=await request('/api/media','POST',{name:'example.png',base64:image});assert.equal(upload.status,201);const media=await upload.json();assert.equal((await request(media.url)).headers.get('content-type'),'image/png');
    let updated=await (await request('/api/page?file=index.html')).json();
    const saveImage=await request('/api/page?file=index.html','PUT',{version:updated.version,values:{...values,[photo.id]:media.url}});assert.equal(saveImage.status,200);
    const imageVersion=(await saveImage.json()).version;await request('/api/publish','POST',{file:'index.html',version:imageVersion});assert.ok((await (await request('/')).text()).includes(media.url));
    const link=page.fields.find(f=>f.type==='link');updated=await (await request('/api/page?file=index.html')).json();
    assert.equal((await request('/api/page?file=index.html','PUT',{version:updated.version,values:{[link.id]:'javascript:alert(1)'}})).status,400);
    const cross=await fetch(base+'/api/publish',{method:'POST',headers:{cookie,'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'});assert.equal(cross.status,403);
    assert.equal((await request('/sitemap.xml')).status,200);assert.match(await (await request('/robots.txt')).text(),/Disallow: \/admin/);
    assert.equal((await request('/api/restore','POST',{file:'index.html',version:updated.version,index:'original'})).status,200);
    assert.match(await (await request('/')).text(),/New SEO title/);
    assert.doesNotMatch(await (await request('/index.html?preview=1')).text(),/New SEO title/);
    updated=await (await request('/api/page?file=index.html')).json();
    assert.equal((await request('/api/restore','POST',{file:'index.html',version:updated.version,index:0})).status,200);
    assert.match(await (await request('/index.html?preview=1')).text(),/New SEO title/);
    assert.equal((await request('/api/inquiries','POST',{name:'Client',email:'client@example.com',message:'Need a custom site'},false)).status,201);
    assert.equal((await request('/api/inquiries','GET',undefined,false)).status,401);
    assert.equal((await (await request('/api/inquiries')).json()).length,1);
    await close(server);server=createServer({secret,dataDir:dir,production:false});base=await listen(server);
    assert.match(await (await request('/')).text(),/New SEO title/);assert.equal((await request(media.url)).status,200);assert.equal((await request('/api/session')).status,401);
  } finally {await close(server);if(path.dirname(path.resolve(dir))===path.resolve(os.tmpdir())&&path.basename(dir).startsWith('duoonex-test-'))fs.rmSync(dir,{recursive:true,force:true});}
});
test('Missing or short admin secret prevents startup',()=>{assert.throws(()=>createServer({secret:'short'}),/at least 32/);});
