const form=document.querySelector('#editor'),status=document.querySelector('#status');
const access=document.createElement('section'); access.innerHTML='<h2>Access</h2><label>CMS admin token</label><input id="cms-token" type="password" required><p>Set CMS_ADMIN_TOKEN on the server before saving.</p>'; form.prepend(access);
const fields=[...form.querySelectorAll('[name]')];
const get=(obj,key)=>key.split('.').reduce((v,k)=>v?.[k],obj)||'';
async function load(){const data=await (await fetch('/api/content')).json(); fields.forEach(f=>f.value=get(data,f.name));}
form.addEventListener('submit',async e=>{e.preventDefault();const current=await (await fetch('/api/content')).json();fields.forEach(f=>{const keys=f.name.split('.');let obj=current;keys.slice(0,-1).forEach(k=>obj=obj[k]||(obj[k]={}));obj[keys.at(-1)]=f.value;});const res=await fetch('/api/content',{method:'PUT',headers:{'Content-Type':'application/json','x-admin-token':document.querySelector('#cms-token').value},body:JSON.stringify(current)});status.textContent=res.ok?'Saved.':'Save failed — check token.';setTimeout(()=>status.textContent='',2500);});
load();
