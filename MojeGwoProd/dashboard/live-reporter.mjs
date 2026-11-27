import fs from 'node:fs';
import path from 'node:path';
export function writeEvent(kind, text, extra={}) {
 const directory=process.env.MOJE_GWO_LIVE_DIR;
 if(!directory)return;
 fs.mkdirSync(directory,{recursive:true});
 // Wyłącznie kontrolowane nazwy scenariuszy i kroków; bez stdout, argumentów akcji i URL.
 fs.appendFileSync(path.join(directory,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),kind,text,...extra})+'\n');
}
export default class LiveReporter {
 onBegin(config,suite){writeEvent('start','Przygotowanie sesji i uruchomienie testów',{total:suite.allTests().length});}
 onTestBegin(test){writeEvent('test',test.title);}
 onStepBegin(test,result,step){if(step.category==='test.step')writeEvent('step',step.title);}
 onStepEnd(test,result,step){if(step.category==='test.step'&&step.error)writeEvent('error','Krok zakończył się błędem. Szczegóły w raporcie.');}
 onTestEnd(test,result){writeEvent('result',test.title,{status:result.status,duration:result.duration});}
 onError(){writeEvent('error','Nie udało się przygotować lub wykonać testów. Sprawdź wynik logowania i raport.');}
 onEnd(result){writeEvent('end','Przebieg zakończony',{status:result.status});}
}
