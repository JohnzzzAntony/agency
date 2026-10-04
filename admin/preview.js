document.addEventListener('click',function(event){
  const el=event.target.closest('[data-editor-fields]');
  if(!el)return;
  event.preventDefault();event.stopImmediatePropagation();
  window.parent.postMessage({type:'duoonex-field',ids:el.dataset.editorFields.split(' ')},window.location.origin);
},true);
document.addEventListener('submit',event=>event.preventDefault(),true);
