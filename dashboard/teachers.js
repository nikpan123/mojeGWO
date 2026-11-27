(()=>{
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let data=null,teacherId='',resourceId='',revision=-1,busy=false;
 const materialQueries=new Map();
 const normalized=value=>String(value||'').toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/ł/g,'l').trim();
 function filterMaterials(scope){
  const input=$('#teacher-detail').querySelector('[data-material-search="'+scope+'"]');if(!input)return;
  const query=normalized(input.value),rows=[...$('#teacher-detail').querySelectorAll('[data-material-row="'+scope+'"]')];let visible=0;
  for(const row of rows){row.hidden=!normalized(row.dataset.materialTitle).includes(query);if(!row.hidden)visible++;}
  const empty=$('#teacher-detail').querySelector('[data-material-empty="'+scope+'"]');if(empty)empty.hidden=visible>0||rows.length===0;
  const count=$('#teacher-detail').querySelector('[data-material-count="'+scope+'"]');if(count)count.textContent='Pokazano '+visible+' z '+rows.length+' materiałów';
 }
 $('#teacher-detail').addEventListener('input',event=>{const scope=event.target.dataset.materialSearch;if(!scope)return;materialQueries.set(teacherId+':'+scope,event.target.value);filterMaterials(scope);});
 const message=text=>{$('#teacher-message').textContent=text;};
 const teacher=()=>data.teachers.find(t=>t.id===teacherId);
 async function change(action,input){
  busy=true;message('Zapisywanie…');
  try{
   const r=await fetch('/api/teachers/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify({revision:data.revision,...input})});
   const body=await r.json();if(!r.ok)throw new Error(body.error);data=body.profiles;revision=-1;message(action==='inspect'?`Odczytano konto i ${body.count} materiałów. Wybierz, które mają być kontrolowane.`:'Zapisano.');await window.refreshMojeGwo?.();return body;
  }catch(e){message(e.message);throw e;}finally{busy=false;}
 }
 function editor(t=null){
  const f=$('#teacher-form');f.reset();f.elements.id.value=t?.id||'';f.elements.label.value=t?.label||'';f.elements.accountEmail.value=t?.accountEmail||'';f.elements.accountDisplayName.value=t?.accountDisplayName||'';f.elements.accountUserId.value=t?.accountUserId||'';f.elements.enabled.checked=t?.enabled!==false;f.elements.sharedGitlab.checked=t?.sharedGitlab!==false;$('#teacher-dialog-title').textContent=t?'Edytuj nauczyciela':'Dodaj nauczyciela';$('#teacher-form-error').textContent='';$('#teacher-dialog').showModal();
 }
 function materialEditor(resource=null,catalog=null){
  const f=$('#material-form');f.reset();resourceId=resource?.id||'';
  const value=resource||catalog||{};f.elements.title.value=value.title||'';f.elements.displayTitle.value=value.displayTitle||'';f.elements.kind.value=value.kind||'multipodrecznik';f.elements.groupLabel.value=value.groupLabel||'';f.elements.entryURL.value=value.entryURL||'';
  f.elements.description.value=value.description||'';f.elements.libraryLabel.value=value.libraryLabel||'';f.elements.adapter.value=resource?.adapter||(resource?'template':value.kind==='aplikacja'?'access':'reader');f.elements.enabled.checked=value.enabled!==false;
  f.elements.templateId.innerHTML='<option value="">Bez wzorca</option>'+data.templates.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
  f.elements.templateId.value=resource?.templateId||(resource&&data.templates.some(t=>t.id===resource.id)?resource.id:'');
  f.elements.acceptRules.checked=!!resource?.approvedRules;f.dataset.observedId=String(resource?.observedAccess?.id||catalog?.id||'');
  $('#material-dialog-title').textContent=resource?'Edytuj kontrolę materiału':'Przypisz materiał';$('#material-form-error').textContent='';materialOptions();$('#material-dialog').showModal();
 }
 function materialOptions(){
  const f=$('#material-form'),adapter=f.elements.adapter.value,usesTemplate=adapter==='template',t=usesTemplate?data.templates.find(t=>t.id===f.elements.templateId.value):null;
  f.elements.templateId.closest('label').hidden=!usesTemplate;
  f.elements.templateId.disabled=!usesTemplate;
  $('#library-field').hidden=adapter!=='composer';f.elements.libraryLabel.required=adapter==='composer';
  f.elements.libraryLabel.placeholder='Np. 6 — numer z kafelka klasy w Kompozytorze';
  $('#library-field').firstChild.textContent='Klasa lub biblioteka wewnątrz Kompozytora (np. 6)';
  f.elements.groupLabel.closest('label').firstChild.textContent='Grupa na stronie „Moje dostępy” (opcjonalnie)';
  f.elements.groupLabel.placeholder='Np. Nauczanie wielopoziomowe lub Szkoła podstawowa kl. 5';
  const entry=f.elements.entryURL,worksheets=adapter==='worksheets';
  const worksheetURL='https://kartypracy.apps.'+(document.body.dataset.environment==='prod'?'gwo.pl':'gwotest.pl')+'/25/EW/1';
  entry.required=worksheets;
  entry.closest('label').firstChild.textContent=worksheets?'Adres katalogu Kart pracy (wymagany, bez parametrów)':'Adres aplikacji lub czytnika (opcjonalnie, bez parametrów)';
  entry.placeholder=worksheets?worksheetURL:'';
  if(worksheets&&!entry.value.trim())entry.value=worksheetURL;
  const recognized=!!t?.approvedRules||['composer','worksheets'].includes(adapter);$('#rules-field').hidden=!recognized;f.elements.acceptRules.disabled=!recognized;if(!recognized)f.elements.acceptRules.checked=false;
  $('#adapter-note').textContent=adapter==='access'?'Sprawdzimy obecność i ważność dostępu. Działanie aplikacji nie będzie oznaczone jako sprawdzone.':adapter==='reader'?'Sprawdzimy obrazy stron oraz przejście do następnej rozkładówki.':adapter==='worksheets'?'Sprawdzimy katalog i załadowane zadania dla klas 1–3, blokując zapis zestawów.':adapter==='composer'?'Wpisz numer klasy z kafelka w Kompozytorze, np. 6. Sprawdzimy wejście do tej klasy i listę „Twoje zestawy”, bez zmiany zestawów. Grupę z „Moich dostępów” wpisz w osobnym polu poniżej.':'Użyjemy wcześniej skonfigurowanej czynności ze wzorca. Wybierz wzorzec pasujący do tej aplikacji.';
 }
 $('#add-teacher').onclick=()=>editor();
 $('#teacher-form').onsubmit=async e=>{
  e.preventDefault();const f=e.target,t=Object.fromEntries(new FormData(f));t.enabled=f.elements.enabled.checked;t.sharedGitlab=f.elements.sharedGitlab.checked;
  const credentials={portalPassword:f.elements.portalPassword.value,gitlabPassword:f.elements.gitlabPassword.value,gitlabLogin:f.elements.gitlabLogin.value};delete t.portalPassword;delete t.gitlabPassword;delete t.gitlabLogin;
  f.elements.portalPassword.value='';f.elements.gitlabPassword.value='';const submit=f.querySelector('[type=submit]');submit.disabled=true;
  try{const result=await change('save',{teacher:t,credentials});teacherId=result.id;$('#teacher-dialog').close();revision=-1;await window.refreshMojeGwo?.();}catch(e){$('#teacher-form-error').textContent=e.message;}finally{credentials.portalPassword='';credentials.gitlabPassword='';submit.disabled=false;}
 };
 $('#material-form').onsubmit=async e=>{
  e.preventDefault();const f=e.target,r=Object.fromEntries(new FormData(f));if(resourceId)r.id=resourceId;r.enabled=f.elements.enabled.checked;r.acceptRules=f.elements.acceptRules.checked;
  if(f.dataset.observedId)r.observedAccess={id:Number(f.dataset.observedId)};const submit=f.querySelector('[type=submit]');submit.disabled=true;
  try{await change('resource',{teacherId,resource:r});$('#material-dialog').close();}catch(e){$('#material-form-error').textContent=e.message;}finally{submit.disabled=false;}
 };
 $('#material-form').elements.adapter.onchange=materialOptions;
 $('#material-form').elements.templateId.onchange=()=>{const f=$('#material-form'),t=data.templates.find(t=>t.id===f.elements.templateId.value);if(t){f.elements.adapter.value='template';if(!f.elements.title.value)f.elements.title.value=t.title;if(!f.elements.displayTitle.value)f.elements.displayTitle.value=t.displayTitle||t.title;if(!f.elements.groupLabel.value)f.elements.groupLabel.value=t.groupLabel||'';if(!f.elements.entryURL.value)f.elements.entryURL.value=t.entryURL||'';}materialOptions();};
 document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>{const dialog=b.closest('dialog');dialog.querySelectorAll('input[type=password]').forEach(i=>i.value='');dialog.close();});
 $('#teacher-dialog').addEventListener('close',()=>$('#teacher-dialog').querySelectorAll('input[type=password]').forEach(i=>i.value=''));
 $('#teacher-list').onclick=e=>{const b=e.target.closest('[data-teacher]');if(b){teacherId=b.dataset.teacher;revision=-1;window.refreshMojeGwo?.();}};
 $('#teacher-detail').onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.dataset.action==='edit')editor(teacher());
   if(b.dataset.action==='select')await change('select',{id:teacherId});
   if(b.dataset.action==='archive')await change('archive',{id:teacherId});
   if(b.dataset.action==='inspect'){b.disabled=true;message('Logowanie i odczyt konta… Nie loguj się równolegle na to konto.');await change('inspect',{id:teacherId});}
   if(b.dataset.action==='add-resource')materialEditor();
   if(b.dataset.editResource)materialEditor(teacher().resources.find(r=>r.id===b.dataset.editResource));
   if(b.dataset.removeResource)await change('resource',{teacherId,removeId:b.dataset.removeResource});
   if(b.dataset.addCatalog)materialEditor(null,teacher().catalog.find(c=>c.id===b.dataset.addCatalog));
  }catch{}finally{b.disabled=false;}
 };
 $('#teacher-choice').onchange=async e=>{try{await change('select',{id:e.target.value});}catch{revision=-1;await window.refreshMojeGwo?.();}};
 window.renderTeachers=state=>{
  data=state.profiles;if(!data)return;const select=$('#teacher-choice');if(select.dataset.revision!==String(data.revision)){select.innerHTML=data.teachers.filter(t=>t.enabled).map(t=>`<option value="${esc(t.id)}">${esc(t.label)} · ${esc(t.accountEmail)}</option>`).join('');select.dataset.revision=String(data.revision);}select.value=data.selectedId;select.disabled=state.running||state.busy;
  if(revision===data.revision)return;revision=data.revision;if(!teacherId||!data.teachers.some(t=>t.id===teacherId))teacherId=data.selectedId;
  $('#teacher-list').innerHTML=data.teachers.map(t=>`<button data-teacher="${esc(t.id)}" class="teacher-item ${t.id===teacherId?'selected':''}"><strong>${esc(t.label)}</strong><small>${esc(t.accountEmail)}</small><small>${!t.enabled?'Wyłączony':t.id===data.selectedId?'Wybrany do testów':'Aktywny'}</small></button>`).join('');
  const t=teacher();if(!t)return;
  const resources=t.resources||[],catalog=t.catalog||[];
  $('#teacher-detail').innerHTML=`<article><div class="heading"><div><h3>${esc(t.label)}</h3><p>${esc(t.accountEmail)}</p></div><div class="actions"><button data-action="edit" class="secondary">Edytuj profil</button>${t.enabled&&t.id!==data.selectedId?'<button data-action="select">Wybierz do testów</button>':''}${t.enabled?'<button data-action="archive" class="secondary">Wyłącz profil</button>':''}</div></div><p>Tożsamość: ${t.accountUserId?esc(t.accountDisplayName)+' · ID '+esc(t.accountUserId):'do potwierdzenia przez odczyt konta'}</p><p>Dane logowania: ${t.credentialStatus.source==='env'?'dotychczasowy plik .env':t.credentialStatus.portal?'hasło zapisane lokalnie w zaszyfrowanej postaci':'brak zapisanego hasła'}</p><button data-action="inspect" ${!t.enabled?'disabled':''}>Pobierz dostępy z konta</button><p class="hint">Ta operacja loguje konto i odczytuje jego materiały. Nie uruchamia testów aplikacji i nie usuwa zapisanych oczekiwań.</p>${t.inspectedAt?'<small>Ostatni odczyt: '+esc(new Date(t.inspectedAt).toLocaleString('pl-PL'))+'</small>':''}</article>
  <article><div class="heading"><h3>Materiały do sprawdzania (${resources.length})</h3><button data-action="add-resource">Przypisz materiał</button></div><label class="material-search">Szukaj w materiałach do sprawdzania<input type="search" data-material-search="assigned" aria-label="Szukaj w materiałach do sprawdzania" placeholder="Wpisz fragment nazwy materiału…" ></label><p class="hint" data-material-count="assigned" role="status"></p><div class="table"><table><thead><tr><th>Materiał</th><th>Kontrola</th><th>Opcje</th></tr></thead><tbody>${resources.map(r=>`<tr data-material-row="assigned" data-material-title="${esc(r.title)}"><td>${esc(r.title)}${r.enabled===false?'<br><small>Wyłączony</small>':''}</td><td>${r.checkMode==='access'?'Tylko dostęp':'Dostęp i działanie'}</td><td><button class="secondary" data-edit-resource="${esc(r.id)}">Edytuj</button><button class="secondary" data-remove-resource="${esc(r.id)}">Odłącz</button></td></tr>`).join('')||'<tr><td colspan="3">Przypisz materiały, które powinny być dostępne dla tego nauczyciela.</td></tr>'}<tr data-material-empty="assigned" hidden><td colspan="3">Brak materiałów pasujących do wyszukiwania.</td></tr></tbody></table></div></article>
  <article><h3>Materiały odczytane z konta (${catalog.length})</h3><p class="hint">Lista jest pomocnicza. Do testów trafiają wyłącznie materiały przypisane powyżej.</p><label class="material-search">Szukaj w materiałach odczytanych z konta<input type="search" data-material-search="catalog" aria-label="Szukaj w materiałach odczytanych z konta" placeholder="Wpisz fragment nazwy materiału…" ></label><p class="hint" data-material-count="catalog" role="status"></p><div class="table"><table><thead><tr><th>Nazwa</th><th>Dostęp</th><th>Opcje</th></tr></thead><tbody>${catalog.map(c=>`<tr data-material-row="catalog" data-material-title="${esc(c.title)}"><td title="${esc(c.title)}">${esc(c.title)}<br><small>ID dostępu: ${esc(c.id)} · pełna nazwa z API</small></td><td>${c.teacher?'Nauczycielski':'Inny'} · ${c.expired?'Wygasły':'Aktywny'}</td><td><button data-add-catalog="${esc(c.id)}" ${resources.some(r=>r.title===c.title)?'disabled':''}>${resources.some(r=>r.title===c.title)?'Przypisany':'Dodaj do kontroli'}</button></td></tr>`).join('')||'<tr><td colspan="3">Użyj „Pobierz dostępy z konta”, aby zobaczyć materiały.</td></tr>'}<tr data-material-empty="catalog" hidden><td colspan="3">Brak materiałów pasujących do wyszukiwania.</td></tr></tbody></table></div></article>`;
  for(const scope of ['assigned','catalog']){const input=$('#teacher-detail').querySelector('[data-material-search="'+scope+'"]');input.value=materialQueries.get(teacherId+':'+scope)||'';filterMaterials(scope);}
 };
})();
