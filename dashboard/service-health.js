(()=>{
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let config=null,key='';
 window.renderServiceHealth=state=>{
  if(!state.serviceHealth)return;
  const next=JSON.stringify(state.serviceHealth.config);config=state.serviceHealth.config;
  $('#service-health-message').textContent=state.serviceHealth.message;
  if(key===next)return;key=next;
  $('#service-health-fields').innerHTML=config.services.map(s=>`<article><h3>${esc(s.name)}</h3><p>${esc(s.covers)}</p><label>Adres healthchecka podany przez właściciela<input data-service-url="${esc(s.id)}" type="url" value="${esc(s.url)}" placeholder="https://${esc(s.host)}.${config.environment==='prod'?'gwo.pl':'gwotest.pl'}/…"></label><label><input data-service-confirmed="${esc(s.id)}" type="checkbox" ${s.confirmed?'checked':''}> Właściciel usługi potwierdził ten adres jako healthcheck</label></article>`).join('');
 };
 $('#service-health-form').onsubmit=async e=>{
  e.preventDefault();const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try{
   const services=config.services.map(s=>({...s,url:document.querySelector(`[data-service-url="${s.id}"]`).value,confirmed:document.querySelector(`[data-service-confirmed="${s.id}"]`).checked}));
   const response=await fetch('/api/service-health',{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify({...config,services})});const result=await response.json();if(!response.ok)throw new Error(result.error);
   $('#service-health-save-message').textContent='Zapisano adresy. Nie uruchomiono testów.';key='';await window.refreshMojeGwo?.();
  }catch(e){$('#service-health-save-message').textContent=e.message;}finally{submit.disabled=false;}
 };
})();
