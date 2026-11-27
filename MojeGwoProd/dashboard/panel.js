const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={PASS:'Zaliczony',FAIL:'Niezaliczony',RUNNING:'W trakcie',passed:'Zaliczony',failed:'Błąd',skipped:'Pominięty',timedOut:'Przekroczony czas'};
let selected='',state=null,loading=false,previewKey='',refreshing=false;
function navigate(){const view=location.hash.slice(1)||'overview';document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==view);document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+view));}
window.addEventListener('hashchange',navigate);navigate();
$('#suite-choice').addEventListener('change',()=>void refresh());
$('#run-choice').addEventListener('change',()=>{selected=$('#run-choice').value;previewKey='';void live();});
$('#history').addEventListener('click',e=>{const button=e.target.closest('[data-live]');if(button){selected=button.dataset.live;previewKey='';location.hash='live';void refresh();}});
async function live(){
 if(!selected||loading)return;loading=true;const runId=selected;
 try{
  const response=await fetch(`/api/runs/${runId}/events`);if(!response.ok)return;const data=await response.json();if(selected!==runId)return;
  const events=data.events;const current=[...events].reverse().find(e=>e.kind==='test');const step=[...events].reverse().find(e=>e.kind==='step');const results=events.filter(e=>e.kind==='result');const run=state.history.find(r=>r.id===runId);
  $('#current-test').textContent=current?.text||'Przygotowanie sesji';$('#current-step').textContent=run?.status==='RUNNING'?(step?.text||'Sprawdzanie sesji i logowanie…'):(run?.status==='PASS'?'Wszystkie kontrole zaliczone.':run?.message||'Przebieg zakończony. Szczegóły w raporcie.');
  $('#progress').textContent=`${results.length} / ${run?.expectedCount||5}`;
  $('#logs').textContent=events.length?events.map(e=>`${new Date(e.at).toLocaleTimeString('pl-PL')}  ${e.text}${e.status?' — '+(names[e.status]||e.status):''}`).join('\n'):'Ten przebieg nie ma zapisanych logów kroków. Logi są dostępne dla nowych uruchomień.';
  $('#logs').scrollTop=$('#logs').scrollHeight;$('#logs-link').hidden=false;$('#logs-link').href=`/api/runs/${runId}/events`;
  const key=runId+':'+data.previewUpdatedAt;
  if(data.previewUpdatedAt&&key!==previewKey){previewKey=key;const img=$('#browser-preview');img.onload=()=>{img.hidden=false;$('#preview-note').hidden=true;};img.src=`/api/runs/${runId}/preview?t=${encodeURIComponent(data.previewUpdatedAt)}`;}
  if(!data.previewUpdatedAt){$('#browser-preview').hidden=true;$('#preview-note').hidden=false;$('#preview-note').textContent=run?.suite==='websites'?'Anonimowe kontrole stron. Zrzuty ekranów znajdują się w raporcie.':run?.suite==='services'?'Kontrole endpointów nie otwierają przeglądarki. Dostępne są logi i raport.':run?.preview===false?'Podgląd był wyłączony dla tego przebiegu.':'Podgląd pojawi się po zalogowaniu i otwarciu strony. Starsze przebiegi nie mają podglądu.';}
 }catch{}finally{loading=false;}
}
async function refresh(){
 if(refreshing)return;refreshing=true;
 try{
  const r=await fetch('/api/state');if(!r.ok)throw new Error('Nie udało się odczytać stanu panelu.');state=await r.json();const serviceSuite=$('#suite-choice').value==='services';const websiteSuite=$('#suite-choice').value==='websites',anonymousSuite=serviceSuite||websiteSuite;const suiteState=websiteSuite?state.websiteAvailability:serviceSuite?state.serviceHealth:state;$('#run').disabled=!suiteState.ready||state.running||state.busy;$('#suite-readiness').textContent=suiteState.message;$('#teacher-choice-label').hidden=anonymousSuite;for(const id of ['#preview-enabled','#headed','#speed','#force-login'])document.querySelector(id).closest('label').hidden=anonymousSuite;$('#status').textContent=state.running?'Testy trwają':suiteState.ready?'Gotowe':'Do konfiguracji';$('#readiness').textContent=suiteState.message;
  window.renderTeachers?.(state);
  window.renderServiceHealth?.(state);
  window.renderSchedule?.(state);
  window.renderNotifications?.(state);
  $('#run-heading').textContent=(websiteSuite?3:serviceSuite?state.serviceHealth.expectedCount:state.expectedCount)+' kontroli · '+(document.body.dataset.environment==='prod'?'PROD':'TEST');
  $('#run-scope').textContent=websiteSuite?'3 strony: HTTPS, odpowiedź właściwej aplikacji, oczekiwany publiczny ekran i czas do 15 sekund. Bez logowania; zrzuty ekranów są w raporcie.':serviceSuite?'9 kontroli kontraktu trzech usług. Brak logowania, wyłączania zależności i automatycznej akceptacji odbioru.':'Zakres wynika z materiałów przypisanych do wybranego nauczyciela. Tylko włączone materiały biorą udział w testach.';
  $('#scenarios-list').innerHTML=state.scenarios.map(s=>'<li><b>'+esc(s.code)+'</b> · '+(s.type==='manual'?'Ręczny odbiór na TEST':s.module?.startsWith('Endpointy')?'Automatyczny endpoint':s.module?.startsWith('Dostępność')?'Dostępność strony':'Smoke funkcjonalny')+'<p>'+esc(s.title)+'</p><small>'+esc(s.blocker||s.expected||'')+'</small></li>').join('');
  const last=state.history[0];$('#last-result').textContent=last?(names[last.status]||last.status):'Brak wyników';$('#last-count').textContent=last?.counts?`${last.counts.passed} / ${last.expectedCount||5}`:'—';
  if(!selected&&last)selected=last.id;
  const choice=$('#run-choice');const list=state.history.map(r=>`${r.id}:${r.status}`).join('|');if(choice.dataset.list!==list){choice.dataset.list=list;choice.innerHTML=state.history.map(r=>`<option value="${esc(r.id)}">${esc(new Date(r.startedAt).toLocaleString('pl-PL'))} · ${esc(names[r.status]||r.status)}</option>`).join('')||'<option value="">Brak przebiegów</option>';}
  choice.value=selected;
  $('#history').innerHTML=state.history.map(r=>`<tr><td>${esc(new Date(r.startedAt).toLocaleString('pl-PL'))}</td><td>${esc(r.profileLabel||r.accountEmail||'Dotychczasowy profil')}</td><td class="${r.status==='PASS'?'pass':r.status==='FAIL'?'fail':''}">${esc(names[r.status]||r.status)}</td><td>${r.counts?`${r.counts.passed} / ${r.expectedCount||5}`:'—'}</td><td><button data-live="${esc(r.id)}">Przebieg i logi</button>${/^\/report\/[a-f0-9-]{36}\/$/.test(r.report||'')?`<a href="${r.report}" target="_blank" rel="noopener">Raport ↗</a>`:''}</td></tr>`).join('')||'<tr><td colspan="5">Nie wykonano jeszcze testów.</td></tr>';
  await live();
 }catch(e){$('#message').textContent=e.message;}finally{refreshing=false;}
}
$('#run').addEventListener('click',async()=>{
 $('#run').disabled=true;
 try{const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify({suite:$('#suite-choice').value,profileId:['services','websites'].includes($('#suite-choice').value)?undefined:$('#teacher-choice').value,forceLogin:$('#force-login').checked,preview:$('#preview-enabled').checked,headed:$('#headed').checked,speed:Number($('#speed').value)})});const result=await response.json();if(!response.ok)throw new Error(result.error);selected=result.id;previewKey='';$('#message').textContent='Uruchomiono testy.';location.hash='live';await refresh();}catch(e){$('#message').textContent=e.message;await refresh();}
});
window.refreshMojeGwo=refresh;
void refresh();setInterval(refresh,1000);
