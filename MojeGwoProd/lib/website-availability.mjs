export const websiteDefinitions=[
 {id:'moje-gwo',name:'moje.gwo',url:'https://moje.gwo.pl/',entryTitle:'Moje GWO',screen:'portal-login'},
 {id:'multipodreczniki',name:'Multipodręczniki',url:'https://multipodreczniki.apps.gwo.pl/',entryTitle:'Multiteka GWO',screen:'portal-login'},
 {id:'kompozytor',name:'Kompozytor',url:'https://kompozytorklasowek.apps.gwo.pl/matematyka',entryTitle:'Kompozytor klasówek i kart pracy',screen:'composer-login'}
];
export const websiteLimitMs=15000;
export function websiteReadiness(base){return base.environment==='prod'&&base.runEnabled?{ready:true,expectedCount:3,message:'Anonimowe otwarcie trzech stron, poprawna odpowiedź, oczekiwany ekran i gotowość do 15 sekund. Bez logowania i konta nauczyciela.'}:{ready:false,expectedCount:3,message:'Uruchamianie PROD jest wyłączone.'};}
export function websiteScenarios(){return websiteDefinitions.map(site=>({id:'moje-gwo-prod:WEB-01/'+site.id,code:'WEB-01/'+site.id,project:'moje-gwo-prod',type:'automatic',module:'Dostępność stron PROD',file:'tests/website-availability.spec.mjs',title:site.name+' — dostępność strony',steps:'Otwórz '+site.url+' w pustej sesji. Sprawdź HTTP, tytuł aplikacji oraz oczekiwany ekran wejścia lub logowania.',expected:'Poprawny HTTPS, HTTP 200 i HTML właściwej aplikacji, prawidłowy ekran w ciągu 15 sekund. Strona 404 nie jest zaliczeniem.',tags:['PROD','dostępność','anonimowo'],preconditions:['Brak sesji i danych konta.'],source:'Publiczny ekran aplikacji; nie potwierdza działania wszystkich zależności backendu.'}));}
export async function expectPublicScreen(page,site,expect){
 if(site.screen==='portal-login'){
  await expect(page).toHaveURL(url=>url.origin==='https://moje.gwo.pl'&&url.pathname==='/uzytkownik/');
  await expect(page).toHaveTitle('Logowanie GWO');
  await expect(page.locator('input[name="login"]')).toBeVisible();await expect(page.locator('input[name="password"]')).toBeVisible();await expect(page.getByRole('button',{name:'Zaloguj się',exact:true})).toBeVisible();
 }else{
  await expect(page).toHaveURL(url=>url.origin==='https://kompozytorklasowek.apps.gwo.pl'&&url.pathname==='/matematyka');
  await expect(page).toHaveTitle(site.entryTitle);await expect(page.getByText('Brak autoryzacji',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Przejdź do logowania',exact:true})).toBeVisible();
 }
 await expect(page.getByText('Strona zniknęła... Jesteśmy zgubieni',{exact:true})).toBeHidden();
}
