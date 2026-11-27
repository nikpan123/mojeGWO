(()=>{
 const $=s=>document.querySelector(s),form=$('#schedule-form');let saved=null,dirty=false,pending=false,revision=-1,profiles=[];
 const when=value=>value?new Date(value).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'}):'—';
 const labels={ENABLED:'Włączono',DISABLED:'Wyłączono',START:'Początek cyklu',RUN:'Uruchomienie',PASS:'Zaliczony',FAIL:'Niezaliczony',ERROR:'Błąd',SKIPPED:'Pominięto',STOP:'Zatrzymano kolejkę',END:'Koniec cyklu'};
 function scope(suites,profileId){
  const parts=[],teacher=profiles.find(profile=>profile.id===profileId);
  if(suites.includes('functional')){const resources=(teacher?.resources||[]).filter(resource=>resource.enabled!==false);const count=1+resources.reduce((total,resource)=>total+1+(resource.checkMode==='access'?0:1),0);parts.push('Konto i materiały — '+(teacher?.label||'wybierz nauczyciela')+(resources.length?' ('+count+' kontroli)':' (brak przypisanych materiałów)'));}
  if(suites.includes('websites'))parts.push('Dostępność stron — 3 kontrole bez logowania');
  if(suites.includes('services'))parts.push('Endpointy healthcheck — 9 kontroli');
  return parts.join(' + ');
 }
 function renderSelection(){
  if(!saved)return;
  const suites=['functional','websites'].filter(suite=>form.elements[suite].checked),note=$('#schedule-selection'),teacherStep=$('#schedule-teacher-step');
  if(note)note.textContent=suites.length?(dirty?'Do zapisania: ':'Wybrane testy: ')+scope(suites,form.elements.profileId.value):'Nie wybrano testów. Zaznacz co najmniej jeden zestaw.';
  if(teacherStep)teacherStep.hidden=!form.elements.functional.checked;
  form.querySelector('[type=submit]').disabled=pending||!suites.length;
  $('#schedule-now').disabled=pending||saved.running||dirty||!suites.length;
 }
 form.addEventListener('input',()=>{dirty=true;renderSelection();});
 const options=()=>({enabled:form.elements.enabled.checked,intervalMinutes:Number(form.elements.intervalMinutes.value),suites:['functional','websites'].filter(s=>form.elements[s].checked),profileId:form.elements.profileId.value,revision:saved.revision});
 async function send(path,input){pending=true;try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw new Error(data.error);saved=data.schedule;dirty=false;revision=-1;$('#schedule-message').textContent=path.endsWith('/run')?'Uruchomiono zapisane testy.':saved.enabled?'Zapisano wybór testów i włączono harmonogram.':'Zapisano ustawienia. Automatyczne uruchamianie jest wyłączone.';await window.refreshMojeGwo?.();}catch(e){$('#schedule-message').textContent=e.message;}finally{pending=false;}}
 form.onsubmit=e=>{e.preventDefault();void send('/api/schedule',options());};
 $('#schedule-disable').onclick=()=>saved&&send('/api/schedule',{enabled:false,intervalMinutes:saved.intervalMinutes,suites:saved.suites,profileId:saved.profileId,revision:saved.revision});
 $('#schedule-now').onclick=()=>send('/api/schedule/run',{});
 const outcome=event=>event.type==='PASS'?'pass':['FAIL','ERROR'].includes(event.type)?'fail':event.type==='RUN'?'running':'neutral';
 function renderEvents(){
  if(!saved)return;
  const events=saved.events||[],filter=$('#schedule-event-filter').value;
  const visible=events.filter(event=>filter==='all'||(filter==='results'?['PASS','FAIL'].includes(event.type):outcome(event)==='fail'));
  const summary=$('#schedule-event-summary');summary.replaceChildren();
  for(const [label,count,type] of [['Zaliczone',events.filter(e=>e.type==='PASS').length,'pass'],['Niezaliczone i błędy',events.filter(e=>outcome(e)==='fail').length,'fail'],['Wszystkie wpisy',events.length,'neutral']]){
   const item=document.createElement('div');item.className='schedule-total schedule-total--'+type;
   const number=document.createElement('strong');number.textContent=count;const caption=document.createElement('span');caption.textContent=label;item.append(number,caption);summary.append(item);
  }
  $('#schedule-clear-events').disabled=pending||events.length===0;
  const rows=visible.map(event=>{
   const li=document.createElement('li');li.className='schedule-event schedule-event--'+outcome(event);
   const top=document.createElement('div');top.className='schedule-event-top';
   const badge=document.createElement('span');badge.className='schedule-event-badge';badge.textContent=labels[event.type]||event.type;
   const time=document.createElement('time');time.dateTime=event.at;time.textContent=when(event.at);top.append(badge,time);
   const title=document.createElement('strong');title.className='schedule-event-title';title.textContent=({functional:'Konto nauczyciela i materiały',websites:'Dostępność stron',services:'Endpointy healthcheck'})[event.suite]||'Harmonogram';
   const message=document.createElement('p');message.textContent=event.message;
   li.append(top,title,message);
   if(event.suite==='functional'&&['PASS','FAIL','ERROR'].includes(event.type)){
    if(event.profileLabel){const teacher=document.createElement('p');teacher.textContent='Nauczyciel: '+event.profileLabel;li.append(teacher);}
    if(Array.isArray(event.materials)){
     const box=document.createElement('div');box.className='schedule-materials';const heading=document.createElement('strong');heading.textContent='Materiały objęte przebiegiem ('+event.materials.length+')';box.append(heading);
     const list=document.createElement('ul');for(const material of event.materials){const item=document.createElement('li');const name=document.createElement('span');name.textContent=material.title;const mode=document.createElement('small');mode.textContent=(material.kind==='multipodrecznik'?'Multipodręcznik':'Aplikacja')+' · '+(material.checkMode==='access'?'tylko dostęp':'dostęp i działanie');item.append(name,mode);list.append(item);}box.append(list);li.append(box);
    }else if(event.runId){const note=document.createElement('p');note.className='hint';note.textContent='Brak zapisanej listy materiałów dla tego starszego przebiegu. Sprawdź raport.';li.append(note);}
   }
   if(event.counts){const counts=document.createElement('p');counts.className='schedule-event-counts';counts.textContent='Zaliczone: '+(event.counts.passed||0)+' · Niezaliczone: '+(event.counts.failed||0)+' · Pominięte: '+(event.counts.skipped||0);li.append(counts);}
   if(/^\/report\/[a-f0-9-]{36}\/$/.test(event.report||'')){const link=document.createElement('a');link.href=window.mojeGwoURL(event.report);link.target='_blank';link.rel='noopener';link.textContent='Otwórz raport ↗';li.append(link);}
   return li;
  });
  if(!rows.length){const empty=document.createElement('li');empty.className='schedule-empty';empty.textContent=events.length?'Brak wpisów pasujących do wybranego filtra.':'Dziennik jest pusty. Nowe zdarzenia pojawią się tutaj podczas działania harmonogramu.';rows.push(empty);}
  $('#schedule-events').replaceChildren(...rows);
 }
 $('#schedule-event-filter').onchange=renderEvents;
 $('#schedule-clear-events').onclick=async()=>{
  pending=true;renderEvents();
  try{
   const response=await fetch('/api/schedule/events/clear',{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:'{}'});
   const data=await response.json();if(!response.ok)throw new Error(data.error);saved=data.schedule;
   $('#schedule-events-message').textContent='Dziennik wyczyszczony. Raporty i ustawienia zostały zachowane.';
  }catch(error){$('#schedule-events-message').textContent=error.message;}
  finally{pending=false;renderEvents();await window.refreshMojeGwo?.();}
 };
 window.renderSchedule=state=>{
  if(!state.schedule)return;saved=state.schedule;profiles=state.profiles.teachers;const s=saved;
  $('#schedule-status').textContent=s.running?'Cykl w toku':s.enabled?'Harmonogram włączony':'Harmonogram wyłączony';
  $('#schedule-next').textContent=s.enabled?'Następny cykl: '+when(s.nextRunAt)+' · co '+s.intervalMinutes+' min':'Brak zaplanowanego uruchomienia.';
  if(!dirty&&revision!==s.revision){revision=s.revision;form.elements.enabled.checked=s.enabled;form.elements.intervalMinutes.value=s.intervalMinutes;for(const suite of ['functional','websites'])form.elements[suite].checked=s.suites.includes(suite);const select=form.elements.profileId;select.replaceChildren(...state.profiles.teachers.filter(t=>t.enabled).map(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.label;return o;}));select.value=s.profileId;}
  const savedScope=$('#schedule-saved-scope');if(savedScope)savedScope.textContent='Zapisany zakres: '+scope(s.suites,s.profileId);
  renderSelection();
  $('#schedule-now').disabled=pending||s.running||state.running||state.busy||dirty;
  $('#schedule-disable').disabled=pending||!s.enabled;
  renderEvents();
 };
})();
