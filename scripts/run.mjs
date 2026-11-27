import {spawn} from 'node:child_process';
import path from 'node:path';
import {root,parseEnvironment} from '../lib/environment.mjs';

const [command,...input]=process.argv.slice(2);
const args=[...input];
let selected=process.env.MOJE_GWO_ENV||'test';
for(let index=0;index<args.length;index++) {
  if(args[index]==='--env') {
    if(!args[index+1])throw new Error('Po --env podaj test albo prod.');
    selected=args[index+1];args.splice(index,2);index--;
  } else if(args[index].startsWith('--env=')) {
    selected=args[index].slice(6);args.splice(index,1);index--;
  }
}
selected=parseEnvironment(selected);
const scripts={auth:'save-session.mjs','auth:check':'check-auth.mjs','auth:force':'check-auth.mjs',
  'check:config':'check-config.mjs','test:services':'run-service-health.mjs','test:pages':'run-website-availability.mjs'};
let childArgs;
if(['test','test:headed','test:list','report'].includes(command)) {
  childArgs=[path.join(root,'node_modules/playwright/cli.js'),command==='report'?'show-report':'test',
    ...(command==='test:headed'?['--headed']:command==='test:list'?['--list']:[]),
    ...(command==='report'?[path.join(root,'.health',selected,'playwright-report')]:[]),...args];
} else if(scripts[command])childArgs=[path.join(root,'scripts',scripts[command]),...(command==='auth:force'?['--force']:[]),...args];
else throw new Error('Nieznane polecenie: '+command);
const child=spawn(process.execPath,childArgs,{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,MOJE_GWO_ENV:selected}});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>process.exitCode=code??1);
