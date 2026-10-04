const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const publicDirs = ['about','blog','case-studies','contact','faqs','llm-info','locations','privacy-policy','services','startups','subscription','terms-conditions','testimonials'];
const files = ['index.html', 'CODEINE_Portfolio.html'];
function walk(dir) {
  for (const file of fs.readdirSync(path.join(ROOT, dir), {withFileTypes:true})) {
    const name = dir + '/' + file.name;
    if (file.isDirectory()) walk(name);
    else if (file.name.endsWith('.html')) files.push(name);
  }
}
publicDirs.forEach(walk);
const templates = new Map(files.map(file => [file, fs.readFileSync(path.join(ROOT,file),'utf8')]));
const fingerprints=new Map([...templates].map(([file,html])=>[file,crypto.createHash('sha256').update(html).digest('hex')]));
const titles=new Map([...templates].map(([file,html])=>[file,cheerio.load(html.match(/<title>[\s\S]*?<\/title>/i)?.[0]||'<title>'+file+'</title>')('title').text()]));
const baseCache=new Map();
const css = fs.readFileSync(path.join(ROOT,'assets/css/style.css'),'utf8');
const backgrounds = [];
for (const rule of css.matchAll(/([^{}]+)\{([^{}]*url\(['"]?([^'"\)]+)['"]?\)[^{}]*)\}/g)) {
  backgrounds.push({selector:rule[1].replace(/\/\*[\s\S]*?\*\//g,'').trim(), value:path.posix.normalize('/assets/css/'+rule[3])});
}
function urlAllowed(value, image=false) {
  if (!value || /[\x00-\x20<>"'`\\]/.test(value) || value.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return (image ? /^https:\/\//i : /^(https?:\/\/|mailto:|tel:)/i).test(value);
  return !image || /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value);
}
function documentFor(file, overrides={}, preview=false) {
  const isBase=!preview&&Object.keys(overrides).length===0;
  if(isBase&&baseCache.has(file))return baseCache.get(file);
  const html = templates.get(file);
  if (!html) throw Object.assign(new Error('Page not found'),{status:404});
  const $ = cheerio.load(html);
  $('script[src$="cms.js"]').remove();
  const fields=[];
  let index=0;
  function add(el, type, original, label, apply, attr) {
    const id = 'f'+index++;
    const $el=$(el);
    let group = $el.closest('header,.drawer').length ? 'Navigation' : $el.closest('footer').length ? 'Footer' : $el.closest('head').length ? 'SEO' : '';
    if (!group) { const section=$el.closest('section'); group=section.find('h2,h1').first().text().trim().slice(0,90) || section.attr('class') || 'Page content'; }
    fields.push({id,type,value:Object.hasOwn(overrides,id)?overrides[id]:original,original,label,group,attr});
    if (Object.hasOwn(overrides,id)) apply(overrides[id]);
    if(preview) $el.attr('data-editor-fields',(($el.attr('data-editor-fields')||'')+' '+id).trim());
  }
  $('*').each((_,el)=>{
    const tag=el.tagName;
    if (['script','style','svg','path','noscript'].includes(tag) || $(el).closest('svg,script,style,noscript').length) return;
    const $el=$(el), context=($el.text().trim().replace(/\s+/g,' ').slice(0,65)||$el.attr('class')||tag);
    $el.contents().each((_,node)=>{
      if(node.type==='text' && node.data.trim()) {
        const original=node.data;
        add(el,'text',original,tag+' · '+original.trim().slice(0,70),value=>{node.data=value;});
      }
    });
    const attrs = ['href','src','alt','title','aria-label','placeholder','value','data-base','data-suffix','data-mult','data-tags','data-filter'];
    if(tag==='meta' && ($el.attr('name') || $el.attr('property')) && !['viewport','charset'].includes($el.attr('name'))) attrs.push('content');
    if(tag==='img' && !$el.attr('alt')) $el.attr('alt','');
    for(const attr of attrs) {
      if($el.attr(attr)===undefined || (attr==='href' && tag==='link' && !/^(canonical|alternate|.*icon.*)$/.test($el.attr('rel')||''))) continue;
      const image = (attr==='src' && tag==='img') || (attr==='href' && tag==='link' && /icon/.test($el.attr('rel')||'')) || (attr==='content' && /image/.test($el.attr('property')||$el.attr('name')||''));
      if(attr==='src' && tag!=='img') continue;
      add(el,image?'image':attr==='href'?'link':'attribute',$el.attr(attr),($el.attr('name')||$el.attr('property')||context)+' · '+attr,value=>$el.attr(attr,value),attr);
    }
    let bg;
    for(const rule of backgrounds) { try { if($el.is(rule.selector)) bg=rule.value; } catch {} }
    const inline=($el.attr('style')||'').match(/url\(['"]?([^'"\)]+)['"]?\)/);
    if(inline) bg=inline[1];
    if(bg) add(el,'image',bg,context+' · Background image',value=>{
      const style=($el.attr('style')||'').replace(/background(?:-image)?\s*:[^;]+;?/gi,'');
      $el.attr('style',style+';background-image:url("'+value+'");background-size:cover;background-position:center;');
    });
  });
  $('script[type="application/ld+json"]').each((_,el)=>{
    add(el,'json',$(el).text(),'Structured data (JSON)',value=>$(el).text(JSON.stringify(JSON.parse(value)).replace(/</g,'\\u003c')));
  });
  if(preview) $('body').append('<script src="/admin/preview.js"></script>');
  const result={html:$.html(),fields,title:$('title').text(),fingerprint:crypto.createHash('sha256').update(html).digest('hex')};
  if(isBase)baseCache.set(file,result);
  return result;
}
function validate(file, values) {
  if(!values || typeof values!=='object' || Array.isArray(values)) throw new Error('Invalid fields');
  const schema=new Map(documentFor(file).fields.map(f=>[f.id,f]));
  const result={};
  for(const [id,value] of Object.entries(values)) {
    const field=schema.get(id);
    if(!field || typeof value!=='string' || value.length>40000) throw new Error('Invalid field: '+id);
    if(value===field.original)continue;
    if((field.type==='image' || field.type==='link') && !urlAllowed(value,field.type==='image')) throw new Error('Use a valid image or link URL: '+field.label);
    if(field.type==='json') JSON.parse(value);
    if(field.attr && ['data-base','data-mult'].includes(field.attr) && (!Number.isFinite(Number(value)) || Number(value)<0)) throw new Error('Price and multiplier must be positive numbers');
    if(value!==field.original) result[id]=value;
  }
  return result;
}
module.exports={ROOT,files,documentFor,validate,fingerprints,titles};
