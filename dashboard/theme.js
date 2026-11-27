(() => {
 const key='qa_ui_theme',allowed=['auto','light','dark'],system=matchMedia('(prefers-color-scheme: dark)');
 function read(){try{const cookie=document.cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith(key+'='));const value=cookie?decodeURIComponent(cookie.slice(key.length+1)):localStorage.getItem(key);return allowed.includes(value)?value:'auto';}catch{return 'auto';}}
 function apply(value){document.documentElement.dataset.theme=value==='auto'?(system.matches?'dark':'light'):value;document.documentElement.dataset.themePreference=value;const select=document.querySelector('#theme-mode');if(select)select.value=value;}
 function refresh(){apply(read());}
 refresh();
 document.addEventListener('DOMContentLoaded',()=>{refresh();document.querySelector('#theme-mode')?.addEventListener('change',event=>{const value=event.target.value;if(!allowed.includes(value))return;try{localStorage.setItem(key,value);document.cookie=key+'='+value+'; Path=/; Max-Age=31536000; SameSite=Strict';}catch{}apply(value);});});
 system.addEventListener('change',refresh);addEventListener('storage',refresh);addEventListener('focus',refresh);
})();
