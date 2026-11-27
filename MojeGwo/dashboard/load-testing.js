(()=>{
 const $=s=>document.querySelector(s),form=$('#load-form');let saved=null,dirty=false,pending=false;
 form.addEventListener('input',()=>dirty=true);
 const input=()=>({revision:saved.config.revision,scenario:form.elements.scenario.value,users:Number(form.elements.users.value),durationMinutes:Number(form.elements.durationMinutes.value),profileIds:[...form.querySelectorAll('[name=profileIds]:checked')].map(el=>el.value)});
 async function request(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}
 form.onsubmit=async e=>{e.preventDefault();pending=true;try{await request('/api/load-settings',input());dirty=false;$('#load-message').textContent='Zapisano profil. Test nie został uruchomiony.';await window.refreshMojeGwo?.();}catch(e){$('#load-message').textContent=e.message;}finally{pending=false;}};
 $('#load-run').onclick=async()=>{pending=true;try{await request('/api/run',{suite:'load'});$('#load-message').textContent='Uruchomiono obciążenie TEST. Szczegóły w historii i logach.';location.hash='live';await window.refreshMojeGwo?.();}catch(e){$('#load-message').textContent=e.message;}finally{pending=false;}};
 $('#load-stop').onclick=async()=>{try{await request('/api/load-stop',{});$('#load-message').textContent='Wysłano polecenie zatrzymania.';}catch(e){$('#load-message').textContent=e.message;}};
 window.renderLoadTesting=state=>{
  if(!state.loadTesting)return;saved=state.loadTesting;const c=saved.config;
  if(!dirty){form.elements.scenario.value=c.scenario;form.elements.users.value=c.users;form.elements.durationMinutes.value=c.durationMinutes;$('#load-accounts').replaceChildren(...state.profiles.teachers.filter(t=>t.enabled).map(t=>{const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name='profileIds';checkbox.value=t.id;checkbox.checked=c.profileIds.includes(t.id);label.append(checkbox,document.createTextNode(t.label+(t.accountUserId?'':' — tożsamość niepotwierdzona')));return label;}));}
  $('#load-readiness').textContent=saved.message;$('#load-engine').textContent=saved.engineInstalled?'Silnik k6 1.5.0 dostępny lokalnie.':'Brak silnika k6.';
  $('#load-run').disabled=pending||dirty||!saved.ready||state.running||state.busy;form.querySelector('[type=submit]').disabled=pending||state.running||state.busy;
  $('#load-stop').disabled=!saved.running;
 };
})();
