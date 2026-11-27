(() => {
 const $=selector=>document.querySelector(selector),container=$('#scenario-groups');
 if(!container)return;
 const groups={functional:{title:'Konto nauczyciela i materiały',description:'Konto, aktywne dostępy i działanie materiałów wybranego nauczyciela.'},websites:{title:'Dostępność stron',description:'Anonimowe otwarcie trzech stron i sprawdzenie ich gotowości.'},services:{title:'Endpointy healthcheck usług',description:'Odpowiedź JSON, czas odpowiedzi i nagłówki cache. Wymaga potwierdzonych adresów endpointów.'},load:{title:'Obciążenie TEST',description:'Ręcznie uruchamiane testy k6 na środowisku TEST.'},manual:{title:'Scenariusze ręczne',description:'Instrukcje do samodzielnego wykonania w uzgodnionych warunkach. Nie uruchamiają się automatycznie ani z harmonogramu.'}};
 const groupOf=test=>test.type==='manual'?'manual':test.file==='tests/website-availability.spec.mjs'?'websites':test.file==='tests/service-health.spec.mjs'?'services':test.file?.startsWith('load/')?'load':'functional';
 const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
 const counted=(count,one,few,many)=>count+' '+(count===1?one:count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?few:many);
 let tests=[],signature='';const openGroups=new Map(),openDetails=new Set();
 function render(){
  const query=$('#scenario-search').value.trim().toLocaleLowerCase('pl'),filter=$('#scenario-filter').value;
  const matches=tests.filter(test=>(filter==='all'||groupOf(test)===filter)&&[test.title,test.code,test.steps,test.expected,test.module].join(' ').toLocaleLowerCase('pl').includes(query));
  $('#scenario-results').textContent='Pokazano '+matches.length+' z '+tests.length+' scenariuszy. Rozwiń zestaw lub szczegóły wybranego testu.';
  const nodes=[];
  for(const [key,group] of Object.entries(groups)){
   const rows=matches.filter(test=>groupOf(test)===key);if(!rows.length)continue;
   const section=element('details',null,'scenario-group');section.dataset.group=key;section.open=!!query||filter!=='all'||(openGroups.get(key)??key==='functional');
   const summary=element('summary');summary.append(element('strong',group.title),element('span',key==='manual'?counted(rows.length,'instrukcja','instrukcje','instrukcji'):counted(rows.length,'kontrola','kontrole','kontroli'),'scenario-group-count'));
   section.append(summary,element('p',group.description,'scenario-group-description'));
   const list=element('div',null,'scenario-cards');
   for(const test of rows){
    const card=element('article',null,'scenario-card');
    card.append(element('span',test.type==='manual'?'Ręczny':'Automatyczny','scenario-type'),element('h3',test.title));
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
  const next=JSON.stringify(state.scenarios||[]);if(next===signature)return;signature=next;tests=state.scenarios||[];
  const automatic=tests.filter(test=>test.type!=='manual').length,manual=tests.length-automatic;
  $('#scenario-summary').replaceChildren(element('span',counted(automatic,'kontrola automatyczna','kontrole automatyczne','kontroli automatycznych')),element('span',counted(manual,'instrukcja ręczna','instrukcje ręczne','instrukcji ręcznych')));
  const filter=$('#scenario-filter'),selected=filter.value;
  filter.replaceChildren(new Option('Wszystkie zestawy','all'),...Object.entries(groups).filter(([key])=>tests.some(test=>groupOf(test)===key)).map(([key,value])=>new Option(value.title+' ('+tests.filter(test=>groupOf(test)===key).length+')',key)));
  filter.value=[...filter.options].some(option=>option.value===selected)?selected:'all';render();
 };
})();
