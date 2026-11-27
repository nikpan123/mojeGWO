import http from 'k6/http';
import {check,sleep} from 'k6';
import exec from 'k6/execution';
const config=JSON.parse(open(__ENV.GWO_LOAD_CONFIG));
if(config.environment!=='test'||config.baseURL!=='https://moje.gwotest.pl'||!['public-page','teacher-panel'].includes(config.loadTest.scenario)||config.loadTest.users<1||config.loadTest.users>50||config.loadTest.durationMinutes<1||config.loadTest.durationMinutes>10)throw new Error('Nieprawidłowy profil obciążenia TEST.');
const users=config.loadTest.users,authenticated=config.loadTest.scenario==='teacher-panel';
const accounts=authenticated?JSON.parse(open(__ENV.GWO_LOAD_SECRETS_FILE)):[];
if(authenticated&&accounts.length!==users)throw new Error('Brak oddzielnej sesji TEST dla każdego użytkownika.');
export const options={scenarios:{load_test:{executor:'constant-vus',vus:users,duration:config.loadTest.durationMinutes+'m',gracefulStop:'10s'}},maxRedirects:0,insecureSkipTLSVerify:false,discardResponseBodies:false,summaryTrendStats:['avg','min','med','max','p(90)','p(95)','p(99)'],systemTags:['name','method','status','scenario'],thresholds:{http_req_duration:['p(95)<2000'],http_req_failed:['rate<0.01'],checks:['rate>=0.99']}};
function get(path,headers,name){
 if(!['/uzytkownik/','/api/v3/user_info','/api/v3/my_accesses/mhb','/api/v3/my_accesses/app'].includes(path))throw new Error('Ścieżka poza scenariuszem TEST.');
 return http.get('https://moje.gwotest.pl'+path,{headers,redirects:0,timeout:'10s',tags:{name}});
}
export default function(){
 if(!authenticated){const response=get('/uzytkownik/',{},'public-login-page');check(response,{'HTTP 200 i HTML moje.gwo TEST':r=>r.status===200&&String(r.headers['Content-Type']||'').includes('text/html')&&/<title[^>]*>(Moje GWO|Logowanie GWO)<\/title>/i.test(r.body||'')});}
 else{
  const account=accounts[__VU-1];const response=get('/api/v3/user_info',account.headers,'teacher-identity');let identity;try{identity=response.json();}catch{}
  const valid=check(response,{'Sesja właściwego nauczyciela':r=>r.status===200&&identity?.userId===account.userId});
  if(!valid){exec.test.abort('Utracono potwierdzoną sesję nauczyciela. Przerwano obciążenie.');return;}
  for(const endpoint of ['/api/v3/my_accesses/mhb','/api/v3/my_accesses/app']){const result=get(endpoint,account.headers,endpoint.endsWith('mhb')?'textbook-accesses':'app-accesses');check(result,{'Poprawna lista dostępów':r=>{try{return r.status===200&&Array.isArray(r.json().accesses);}catch{return false;}}});}
 }
 sleep(5);
}
export function handleSummary(data){return {[__ENV.GWO_LOAD_SUMMARY]:JSON.stringify(data)};}
