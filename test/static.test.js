const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const cheerio=require('cheerio');
const {ROOT,files,documentFor}=require('../lib/pages');
const {contentName,valuesFor,renderPage,validateSettings}=require('../lib/static-content');
const {build}=require('../scripts/build');
const YAML=require('yaml');
const load=file=>JSON.parse(fs.readFileSync(path.join(ROOT,'content/pages',contentName(file)),'utf8'));
function entries(record){return record.sections.flatMap(s=>['text','images','details','structuredData'].flatMap(k=>s[k]));}
test('All 80 pages have complete editable records and retain layout',()=>{
  assert.equal(files.length,80);
  for(const file of files){
    const record=load(file),base=documentFor(file);
    const portableSource=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n?/g,'\n');
    assert.equal(record.fingerprint,require('node:crypto').createHash('sha256').update(portableSource).digest('hex'));
    assert.equal(entries(record).length,base.fields.length,file);
    valuesFor(file,record);
    const $=cheerio.load(renderPage(file,record)),original=cheerio.load(base.html);
    for(const selector of ['section','a','svg','h1','img'])assert.equal($(selector).length,original(selector).length,file+' '+selector);
    assert.equal($('h1').html(),original('h1').html(),file);
    assert.equal($('script[src$="cms.js"]').length,0);
    assert.ok(record.sections.some(s=>s.images.length),file);
  }
});
test('CMS changes render safely, preserve heading markup and work at nested URLs',()=>{
  const file='services/web-design/index.html',record=load(file),fields=documentFor(file).fields;
  const heading=fields.find(f=>f.label.startsWith('h1 ·'));
  const image=fields.find(f=>f.type==='image'&&f.label.includes('Background'));
  const title=fields.find(f=>f.label.startsWith('title ·'));
  assert.ok(heading&&image&&title);
  entries(record).find(f=>f.id===heading.id).value='Edited <script>alert(1)</script> heading';
  entries(record).find(f=>f.id===image.id).value='/assets/images/custom-dashboard.png';
  entries(record).find(f=>f.id===title.id).value='Custom websites in Dubai';
  const html=renderPage(file,record,{siteUrl:'https://example.com/agency',contactEmail:'editor@example.com'});
  assert.match(html,/Edited &lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);
  assert.match(html,/<title>Custom websites in Dubai<\/title>/);
  assert.match(html,/\.\.\/\.\.\/assets\/images\/custom-dashboard.png/);
  assert.match(html,/https:\/\/example.com\/agency\/services\/web-design\//);
  const broken=structuredClone(record);broken.fingerprint='stale';assert.throws(()=>renderPage(file,broken),/template changed/);
  const missing=structuredClone(record);missing.sections[0].text.pop();assert.throws(()=>valuesFor(file,missing),/fields were added or removed/);
  const unsafe=structuredClone(record);entries(unsafe).find(f=>f.id===image.id).value='javascript:alert(1)';assert.throws(()=>valuesFor(file,unsafe),/valid image/);
});
test('Static deployment artifact has all pages and no backend or private content',()=>{
  const output=build({siteUrl:'https://example.com/agency'});
  for(const file of files)assert.ok(fs.existsSync(path.join(output,file)),file);
  for(const file of ['server.js','content','data','node_modules','.env','.git','package.json','api'])assert.equal(fs.existsSync(path.join(output,file)),false,file);
  assert.ok(fs.existsSync(path.join(output,'assets/images/duoonex-logo.png')));
  assert.match(fs.readFileSync(path.join(output,'admin/index.html'),'utf8'),/https:\/\/app.pagescms.org\//);
  const sitemap=fs.readFileSync(path.join(output,'sitemap.xml'),'utf8');assert.equal((sitemap.match(/<url>/g)||[]).length,79);
  const main=fs.readFileSync(path.join(output,'assets/js/main.js'),'utf8');assert.doesNotMatch(main,/\/api\//);
  // Every local image, script and stylesheet in the generated site must resolve inside dist.
  for(const file of files){
    const $=cheerio.load(fs.readFileSync(path.join(output,file),'utf8'));
    $('img[src],script[src],link[rel="stylesheet"]').each((_,el)=>{
      const url=$(el).attr('src')||$(el).attr('href');if(/^(https?:|data:)/.test(url))return;
      assert.ok(fs.existsSync(path.resolve(output,path.dirname(file),url)),file+' '+url);
    });
  }
});
test('Hosted form settings require safe HTTPS URLs',()=>{
  assert.doesNotThrow(()=>validateSettings({contactEmail:'hello@example.com',formEndpoint:'https://formspree.io/f/example',siteUrl:''}));
  assert.throws(()=>validateSettings({contactEmail:'bad',siteUrl:''}),/contact email/);
  assert.throws(()=>validateSettings({contactEmail:'hello@example.com',formEndpoint:'javascript:alert(1)'}),/HTTPS/);
});
test('Hosted CMS configuration describes the stored page schema and deployment is opt-in',()=>{
  const config=YAML.parse(fs.readFileSync(path.join(ROOT,'.pages.yml'),'utf8'));
  const pages=config.content.find(c=>c.name==='pages');
  assert.equal(pages.path,'content/pages');assert.equal(pages.format,'json');assert.equal(pages.operations.delete,false);
  assert.equal(config.media.input,'assets/images');assert.equal(config.media.output,'/assets/images');
  const sections=pages.fields.find(f=>f.name==='sections');
  for(const kind of ['text','images','details','structuredData']){
    const field=sections.fields.find(f=>f.name===kind);assert.ok(field);assert.ok(config.components[field.component]);
    assert.ok(config.components[field.component].fields.some(f=>f.name==='id'&&f.readonly&&f.hidden));
  }
  assert.equal(config.components.imageFields.fields.find(f=>f.name==='value').type,'image');
  const workflow=YAML.parse(fs.readFileSync(path.join(ROOT,'.github/workflows/static-site.yml'),'utf8'));
  assert.deepEqual(workflow.on.push.branches,['main']);
  assert.match(workflow.jobs.deploy.if,/ENABLE_PAGES_DEPLOYMENT/);
  assert.ok(workflow.jobs.build.steps.some(s=>s.run==='npm test'));
});
