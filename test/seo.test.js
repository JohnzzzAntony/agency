const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('../server');
const seo=require('../lib/seo');
test('Public SEO uses the configured origin and excludes retired/noindex routes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'duoonex-seo-'));
  const server=createServer({secret:'test-only-seo-secret-12345678901234567890',dataDir:dir,siteUrl:'https://duoonex.example'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const html=await (await fetch(base+'/case-studies/nexora/')).text();
    assert.match(html,/rel="canonical" href="https:\/\/duoonex\.example\/case-studies\/nexora\/"/);
    assert.doesNotMatch(html,/https:\/\/duoonex\.com/);
    const sitemap=await (await fetch(base+'/sitemap.xml')).text();
    assert.match(sitemap,/https:\/\/duoonex\.example\/case-studies\/finora\//);
    assert.doesNotMatch(sitemap,/rooda|CODEINE|ui-ux-agency-in-london/);
    const redirect=await fetch(base+'/case-studies/rooda/index.html',{redirect:'manual'});
    assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/case-studies/nexora/');
    assert.match(await (await fetch(base+'/robots.txt')).text(),/Disallow: \/api\//);
    assert.match(await (await fetch(base+'/llms.txt')).text(),/\[Finora\]\(https:\/\/duoonex\.example/);
    const media=base+'/assets/images/projects/invitara.mp4';
    const partial=await fetch(media,{headers:{Range:'bytes=0-31'}});
    assert.equal(partial.status,206);assert.equal(partial.headers.get('content-type'),'video/mp4');
    assert.equal((await partial.arrayBuffer()).byteLength,32);
    const suffix=await fetch(media,{headers:{Range:'bytes=-16'}});
    assert.equal(suffix.status,206);assert.equal((await suffix.arrayBuffer()).byteLength,16);
    assert.equal((await fetch(media,{headers:{Range:'bytes=999999999999-'}})).status,416);
    const head=await fetch(media,{method:'HEAD'});assert.equal(head.status,200);assert.ok(Number(head.headers.get('content-length'))>0);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
test('Canonical origin rejects URL credentials and paths',()=>{
  assert.equal(seo.siteOrigin(),'https://duoonex.com');
  for(const value of ['javascript:alert(1)','https://user:password@example.com','https://example.com/site/'])assert.throws(()=>seo.siteOrigin(value));
});
