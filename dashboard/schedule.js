(()=>{
 const $=s=>document.querySelector(s),form=$('#schedule-form');let saved=null,dirty=false,pending=false,revision=-1;
 const when=value=>value?new Date(value).toLocaleString('pl-PL'):'—';
 const labels={ENABLED:'Włączono',DISABLED:'Wyłączono',START:'Początek cyklu',RUN:'Uruchomienie',PASS:'Zaliczony',FAIL:'Niezaliczony',ERROR:'Błąd',SKIPPED:'Pominięto',STOP:'Zatrzymano kolejkę',END:'Koniec cyklu'};
 form.addEventListener('input',()=>{dirty=true;});
 const options=()=>({enabled:form.elements.enabled.checked,intervalMinutes:Number(form.elements.intervalMinutes.value),suites:['functional','websites'].filter(s=>form.elements[s].checked),profileId:form.elements.profileId.value,revision:saved.revision});
 async function send(path,input){pending=true;try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw new Error(data.error);saved=data.schedule;dirty=false;revision=-1;$('#schedule-message').textContent='Zapisano. Rozpoczęty test może się dokończyć.';await window.refreshMojeGwo?.();}catch(e){$('#schedule-message').textContent=e.message;}finally{pending=false;}}
 form.onsubmit=e=>{e.preventDefault();void send('/api/schedule',options());};
 $('#schedule-disable').onclick=()=>saved&&send('/api/schedule',{...saved,enabled:false});
 $('#schedule-now').onclick=()=>send('/api/schedule/run',{});
 window.renderSchedule=state=>{
  if(!state.schedule)return;saved=state.schedule;const s=saved;
  $('#schedule-status').textContent=s.running?'Cykl w toku':s.enabled?'Harmonogram włączony':'Harmonogram wyłączony';
  $('#schedule-next').textContent=s.enabled?'Następny cykl: '+when(s.nextRunAt)+' · co '+s.intervalMinutes+' min':'Brak zaplanowanego uruchomienia.';
  if(!dirty&&revision!==s.revision){revision=s.revision;form.elements.enabled.checked=s.enabled;form.elements.intervalMinutes.value=s.intervalMinutes;for(const suite of ['functional','websites'])form.elements[suite].checked=s.suites.includes(suite);const select=form.elements.profileId;select.replaceChildren(...state.profiles.teachers.filter(t=>t.enabled).map(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.label;return o;}));select.value=s.profileId;}
  const roots=[];
  $('#schedule-health-note').textContent=roots.length?'Uwaga: adresy healthchecków wskazują strony główne. Zestaw endpointów będzie wykazywał błędy kontraktu, dopóki nie wpiszesz właściwych endpointów w „Healthcheck usług”.':'Dostępność stron nie wymaga endpointów JSON ani konta nauczyciela. Sprawdzamy publiczne ekrany, bez logowania.';
  $('#schedule-now').disabled=pending||s.running||state.running||state.busy||dirty;
  $('#schedule-disable').disabled=pending||!s.enabled;
  form.querySelector('[type=submit]').disabled=pending;
  $('#schedule-events').replaceChildren(...s.events.slice(0,30).map(e=>{const li=document.createElement('li');li.textContent=when(e.at)+' · '+(labels[e.type]||e.type)+' · '+(e.suite==='functional'?'Konto i materiały · ':e.suite==='websites'?'Dostępność stron · ':e.suite==='services'?'Endpointy · ':'')+e.message;if(/^\/report\/[a-f0-9-]{36}\/$/.test(e.report||'')){const a=document.createElement('a');a.href=e.report;a.target='_blank';a.rel='noopener';a.textContent=' Raport ↗';li.append(a);}return li;}));
 };
})();
