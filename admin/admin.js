'use strict';
const $=selector=>document.querySelector(selector);
let pages=[],current=null,values={},dirty=false,imageTarget=null;
function message(text,error=false){$('#status').textContent=text;$('#status').classList.toggle('error',error);}
async function api(url,options={}) {
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(!response.ok){if(response.status===401){$('#login').hidden=false;$('#app').hidden=true;}throw new Error(data.error||'Request failed');}
  return data;
}
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function action(text,fn){const button=element('button',text,'secondary');button.type='button';button.onclick=()=>Promise.resolve().then(fn).catch(e=>message(e.message,true));return button;}
function show(view){['editor','media-view','inbox'].forEach(id=>$('#'+id).hidden=id!==view);document.querySelectorAll('.actions button').forEach(b=>b.disabled=view!=='editor'||!current);}
function listPages(){const term=$('#page-search').value.toLowerCase();$('#pages').replaceChildren();pages.filter(p=>(p.title+' '+p.file).toLowerCase().includes(term)).forEach(p=>{const b=action(p.title,()=>loadPage(p.file));b.classList.toggle('active',current?.file===p.file);b.append(element('small',p.file+(p.changed?' · Draft':'')));$('#pages').append(b);});}
async function refreshPages(){pages=await api('/api/pages');listPages();}
async function loadPage(file,force=false){if(!force&&dirty&&!confirm('Discard unsaved changes?'))return;current=await api('/api/page?file='+encodeURIComponent(file));values=Object.fromEntries(current.fields.map(f=>[f.id,f.value]));dirty=false;$('#page-title').textContent=current.title;$('#page-path').textContent=current.file;$('#section-filter').replaceChildren(new Option('All sections',''));[...new Set(current.fields.map(f=>f.group))].forEach(group=>$('#section-filter').add(new Option(group,group)));$('#field-search').value='';$('#type-filter').value='';$('#history').replaceChildren(new Option('Original website content','original'));current.history.forEach(h=>$('#history').add(new Option(new Date(h.date).toLocaleString(),h.index)));show('editor');renderFields();listPages();message(current.templateChanged?'Source template changed. Export a backup, then restore original content before editing.':current.changed?'Saved draft is waiting to be published.':'Published content loaded.');}
function renderFields(){
  const term=$('#field-search').value.toLowerCase(),group=$('#section-filter').value,type=$('#type-filter').value;
  const root=$('#fields');root.replaceChildren();
  current.fields.filter(f=>(!group||f.group===group)&&(!type||f.type===type)&&(!term||(f.label+' '+values[f.id]).toLowerCase().includes(term))).forEach(f=>{
    const card=element('article',undefined,'field');card.id=f.id;
    const meta=element('div',undefined,'field-meta');meta.append(element('span',f.group),element('span',f.type));card.append(meta);
    const label=element('label',f.label);label.htmlFor='input-'+f.id;card.append(label);
    let image;if(f.type==='image'){image=element('img');image.src=resolveImage(values[f.id]);image.alt='Current image';image.loading='lazy';card.append(image);}
    const input=element(f.type==='text'||f.type==='json'?'textarea':'input');input.id='input-'+f.id;input.value=values[f.id];
    input.oninput=()=>{values[f.id]=input.value;dirty=true;message('Unsaved changes');};
    if(image)input.onchange=()=>image.src=resolveImage(input.value);
    card.append(input);
    if(image){const buttons=element('div',undefined,'image-actions');buttons.append(action('Choose image',()=>{imageTarget=f.id;return openMedia();}),action('Use original',()=>{values[f.id]=f.original;dirty=true;renderFields();}));card.append(buttons);}
    root.append(card);
  });
  if(!root.children.length)root.append(element('p','No matching fields.'));
}
function resolveImage(value){return new URL(value,new URL('/'+current.file,location.origin)).href;}
async function save(){if(!current)return;const result=await api('/api/page?file='+encodeURIComponent(current.file),{method:'PUT',body:JSON.stringify({version:current.version,values})});current.version=result.version;dirty=false;message('Draft saved. Publish when ready.');await refreshPages();}
async function publish(){await save();await api('/api/publish',{method:'POST',body:JSON.stringify({file:current.file,version:current.version})});await loadPage(current.file,true);await refreshPages();message('Published. Website visitors now see these changes.');}
async function openMedia(){show('media-view');const media=await api('/api/media');$('#media-grid').replaceChildren();media.forEach(item=>{const card=element('article',undefined,'media-card');const img=element('img');img.src=item.url;img.alt=item.name;img.loading='lazy';card.append(img,element('p',item.name));card.append(action(imageTarget?'Use this image':'Copy image path',async()=>{if(imageTarget){values[imageTarget]=item.url;dirty=true;const id=imageTarget;imageTarget=null;show('editor');renderFields();$('#'+id)?.scrollIntoView({block:'center'});message('Image selected. Save and publish the page.');}else{await navigator.clipboard.writeText(item.url);message('Image path copied.');}}));$('#media-grid').append(card);});}
async function upload(file){if(file.size>8*1024*1024)throw new Error('Image exceeds 8 MB');const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});return api('/api/media',{method:'POST',body:JSON.stringify({name:file.name,base64})});}
async function openInbox(){show('inbox');const data=await api('/api/inquiries');$('#inquiries').replaceChildren();if(!data.length)$('#inquiries').append(element('p','No enquiries yet.'));data.forEach(item=>{const card=element('article',undefined,'inquiry');card.append(element('h3',item.name),element('small',new Date(item.created).toLocaleString()));const dl=element('dl');['email','message','budget','source','help'].forEach(key=>{if(item[key])dl.append(element('dt',key),element('dd',item[key]));});card.append(dl,action('Delete enquiry',async()=>{if(!confirm('Permanently delete this enquiry?'))return;await api('/api/inquiries',{method:'DELETE',body:JSON.stringify({id:item.id})});await openInbox();}));$('#inquiries').append(card);});}
function bind(id,handler){$(id).onclick=async()=>{try{$(id).disabled=true;await handler();}catch(e){message(e.message,true);}finally{$(id).disabled=false;}};}
$('#login-form').onsubmit=async event=>{event.preventDefault();try{await api('/api/login',{method:'POST',body:JSON.stringify({password:$('#password').value})});$('#password').value='';await start();}catch(e){$('#login-error').textContent=e.message;}};
bind('#logout',async()=>{if(dirty&&!confirm('Discard unsaved changes and sign out?'))return;await api('/api/logout',{method:'POST',body:'{}'});dirty=false;location.reload();});
bind('#save',save);bind('#publish',publish);
bind('#preview',async()=>{await save();$('#preview-frame').src='/'+current.file+'?preview=1&t='+Date.now();$('#preview-dialog').showModal();});
bind('#close-preview',()=>$('#preview-dialog').close());
bind('#restore',async()=>{if(!confirm('Replace the draft with this version? Published content stays until you publish.'))return;await api('/api/restore',{method:'POST',body:JSON.stringify({file:current.file,version:current.version,index:$('#history').value})});await loadPage(current.file,true);});
bind('#media-tab',()=>{imageTarget=null;return openMedia();});bind('#inbox-tab',openInbox);bind('#pages-tab',()=>{show('editor');});
$('#upload').onchange=async event=>{try{for(const file of event.target.files){message('Uploading '+file.name+'…');await upload(file);}await openMedia();message('Images uploaded.');}catch(e){message(e.message,true);}finally{event.target.value='';}};
$('#page-search').oninput=listPages;['#field-search','#section-filter','#type-filter'].forEach(id=>$(id).oninput=()=>current&&renderFields());
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('#preview-frame').contentWindow||event.data?.type!=='duoonex-field')return;const id=event.data.ids.find(id=>current.fields.some(f=>f.id===id));if(!id)return;$('#preview-dialog').close();$('#field-search').value='';$('#section-filter').value='';$('#type-filter').value='';renderFields();$('#'+id)?.classList.add('selected');$('#'+id)?.scrollIntoView({block:'center'});$('#input-'+id)?.focus({preventScroll:true});});
async function start(){await api('/api/session');$('#login').hidden=true;$('#app').hidden=false;await refreshPages();await loadPage(pages[0].file,true);}
start().catch(e=>{if(e.message!=='Please sign in')$('#login-error').textContent=e.message;});
