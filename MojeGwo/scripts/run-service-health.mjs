import {spawn} from 'node:child_process';
import path from 'node:path';
import {root,readBaseSettings} from '../lib/settings.mjs';
import {loadHealthConfig,healthReadiness} from '../lib/service-health.mjs';
const list=process.argv.includes('--list');const base=readBaseSettings();
if(!list){const state=healthReadiness(loadHealthConfig(root,base.environment),base);if(!state.ready){console.error(state.message);process.exit(1);}}
const child=spawn(process.execPath,[path.join(root,'node_modules/playwright/cli.js'),'test',...(list?['--list']:[])],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,MOJE_GWO_SUITE:'services',MOJE_GWO_RUN_CONFIG:'',MOJE_GWO_PROFILE_ID:''}});
child.on('error',()=>{console.error('Nie udało się uruchomić sprawdzeń endpointów.');process.exitCode=1;});child.on('exit',code=>process.exitCode=code??1);
