(() => {
 const $=selector=>document.querySelector(selector),container=$('#scenario-groups');
 if(!container)return;
 const groups={functional:{title:'Konto nauczyciela i materiały',description:'Ogólne przykłady kontroli. Podczas uruchomienia są wykonywane dla materiałów wybranego nauczyciela; konkretne tytuły i wyniki znajdziesz w konfiguracji oraz raporcie.'},websites:{title:'Dostępność ekranów wejścia',description:'Anonimowe sprawdzenie ekranów wejścia lub logowania; bez potwierdzania działania materiałów.'},services:{title:'Endpointy healthcheck usług',description:'Odpowiedź JSON, czas odpowiedzi i nagłówki cache. Wymaga potwierdzonych adresów endpointów.'},load:{title:'Obciążenie TEST',description:'Ręcznie uruchamiane testy k6 na środowisku TEST.'},manual:{title:'Scenariusze ręczne',description:'Instrukcje do samodzielnego wykonania w uzgodnionych warunkach. Nie uruchamiają się automatycznie ani z harmonogramu.'}};
 const groupOf=test=>test.type==='manual'?'manual':test.file==='tests/website-availability.spec.mjs'?'websites':test.file==='tests/service-health.spec.mjs'?'services':test.file?.startsWith('load/')?'load':'functional';
 const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
 const counted=(count,one,few,many)=>count+' '+(count===1?one:count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?few:many);
 let tests=[],signature='';const openGroups=new Map(),openDetails=new Set();
 const examples=[
  ['HC-01','Konto nauczyciela i sesja','Potwierdzenie, że panel działa i zalogowano właściwego nauczyciela.','Otwórz panel. Porównaj nazwę i identyfikator konta z API oraz widoczną nazwą. Sprawdź wymaganą rolę nauczyciela.'],
  ['HC-02','Aktywny dostęp do materiału','Materiał jest przypisany do konta jako aktywny dostęp nauczycielski.','Odczytaj listę dostępów z API. Rozpoznaj materiał po pełnej nazwie i identyfikatorze, znajdź jego kafelek i sprawdź ważność dostępu.'],
  ['HC-03/czytnik','Multipodręcznik — otwarcie i zmiana stron','Czytnik wyświetla załadowane obrazy, a przejście dalej zmienia strony i ich obrazy.','Uruchom multipodręcznik z kafelka. Poczekaj na obrazy, zapamiętaj oznaczenie stron i ich źródła, kliknij następną stronę i potwierdź zmianę oraz załadowanie nowej treści.'],
  ['HC-03/kompozytor','Kompozytor — klasa i lista zestawów','Lista „Twoje zestawy” została pobrana i wyświetlona; poprawnie obsługiwana jest też pusta lista.','Uruchom Kompozytor z kafelka. Wybierz klasę lub bibliotekę wskazaną w materiale, sprawdź dostęp i otwórz jej widok. Potwierdź odpowiedź HTTP 200 i poprawne dane listy. Otwórz „Twoje zestawy” i porównaj liczbę oraz nazwy pozycji z odpowiedzią. Dla pustej listy wymagaj komunikatu o braku zestawów. Ładowanie musi się zakończyć. Test nie tworzy ani nie usuwa zestawów.'],
  ['HC-03/karty-pracy','Karty pracy — katalog klas 1–3','Katalog pokazuje propozycje i poprawnie załadowane obrazy zadań.','Otwórz aplikację i przejdź do widoku komponowania. Potwierdź klasy 1–3, propozycje zadań i ich obrazy. Nie zapisuj zestawu.']
 ].map(([code,title,expected,steps])=>({id:'example:'+code,code,title,expected,steps,example:true,type:'automatic',file:'tests/health.spec.mjs',preconditions:['Właściwe środowisko i skonfigurowany profil nauczyciela.','Dany wariant jest wykonywany tylko dla materiałów z takim sposobem sprawdzania.']}));
 function render(){
  const query=$('#scenario-search').value.trim().toLocaleLowerCase('pl'),filter=$('#scenario-filter').value;
  const matches=tests.filter(test=>(filter==='all'||groupOf(test)===filter)&&[test.title,test.code,test.steps,test.expected,test.module].join(' ').toLocaleLowerCase('pl').includes(query));
  $('#scenario-results').textContent='Pokazano '+matches.length+' z '+tests.length+' scenariuszy. Rozwiń zestaw lub szczegóły wybranego testu.';
  const nodes=[];
  for(const [key,group] of Object.entries(groups)){
   const rows=matches.filter(test=>groupOf(test)===key);if(!rows.length)continue;
   const section=element('details',null,'scenario-group');section.dataset.group=key;section.open=!!query||filter!=='all'||(openGroups.get(key)??key==='functional');
   const summary=element('summary');summary.append(element('strong',group.title),element('span',key==='functional'?counted(rows.length,'przykład','przykłady','przykładów'):key==='manual'?counted(rows.length,'instrukcja','instrukcje','instrukcji'):counted(rows.length,'kontrola','kontrole','kontroli'),'scenario-group-count'));
   section.append(summary,element('p',group.description,'scenario-group-description'));
   const list=element('div',null,'scenario-cards');
   for(const test of rows){
    const card=element('article',null,'scenario-card');
    card.append(element('span',test.type==='manual'?'Ręczny':test.example?'Automatyczny · przykład':'Automatyczny','scenario-type'),element('h3',test.title));
    if(test.expected)card.append(element('p',test.expected,'scenario-expected'));
    if(test.blocker)card.append(element('p',test.blocker,'scenario-blocker'));
    const details=element('details',null,'scenario-details');details.open=openDetails.has(test.id);details.append(element('summary','Kroki i warunki testu'));
    for(const [label,value] of [['Co wykonuje test',test.steps],['Warunki',Array.isArray(test.preconditions)?test.preconditions.join('\n'):test.preconditions]]){
     if(!value)continue;details.append(element('strong',label),element('p',value));
    }
    details.append(element('strong','Identyfikator'),element('code',test.code||test.id));
    details.addEventListener('toggle',()=>details.open?openDetails.add(test.id):openDetails.delete(test.id));card.append(details);list.append(card);
   }
   section.append(list);section.addEventListener('toggle',()=>openGroups.set(key,section.open));nodes.push(section);
  }
  if(!nodes.length)nodes.push(element('p','Brak scenariuszy pasujących do wyszukiwania. Zmień frazę lub wybierz inny zestaw.','scenario-empty'));
  container.replaceChildren(...nodes);
 }
 $('#scenario-search').addEventListener('input',render);$('#scenario-filter').addEventListener('change',render);
 window.renderScenarios=state=>{
  const next=JSON.stringify(state.scenarios||[]);if(next===signature)return;signature=next;const source=state.scenarios||[];tests=[...(source.some(test=>groupOf(test)==='functional')?examples:[]),...source.filter(test=>groupOf(test)!=='functional')];
  const automatic=tests.filter(test=>test.type!=='manual').length,manual=tests.length-automatic;
  $('#scenario-summary').replaceChildren(element('span',counted(automatic,'opis kontroli automatycznej','opisy kontroli automatycznych','opisów kontroli automatycznych')),element('span',counted(manual,'instrukcja ręczna','instrukcje ręczne','instrukcji ręcznych')));
  const filter=$('#scenario-filter'),selected=filter.value;
  filter.replaceChildren(new Option('Wszystkie zestawy','all'),...Object.entries(groups).filter(([key])=>tests.some(test=>groupOf(test)===key)).map(([key,value])=>new Option(value.title+' ('+tests.filter(test=>groupOf(test)===key).length+')',key)));
  filter.value=[...filter.options].some(option=>option.value===selected)?selected:'all';render();
 };
})();
