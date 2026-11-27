import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {root,parseEnvironment} from '../lib/environment.mjs';
const args=process.argv.slice(2),index=args.indexOf('--env');
const onlyIndex=args.indexOf('--only'),only=onlyIndex>=0?args[onlyIndex+1]:null;
if(only&&!['auth','ui'].includes(only))throw new Error('Nieznany zestaw kontroli lokalnych.');
const environments=only?['test']:index>=0?[parseEnvironment(args[index+1])]:['test','prod'];
const groups=only?{test:[only==='ui'?'panel-ui':'auth']}:{test:['config','dashboard','load-testing','environment','panel-ui','inspect-teacher'],prod:['prod-draft','local-schedule','mattermost']};

// Run on a fresh copy of the code and examples. Local accounts, sessions,
// enabled PROD settings and schedules must never enter installation checks.
const parent=path.join(root,'.health');fs.mkdirSync(parent,{recursive:true});
const fixture=fs.mkdtempSync(path.join(parent,'checks-'));
function copySources(source,destination){
 fs.mkdirSync(destination,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  if(entry.isSymbolicLink()||entry.name.endsWith('.local.json')||entry.name.startsWith('.env'))continue;
  const from=path.join(source,entry.name),to=path.join(destination,entry.name);
  if(entry.isDirectory())copySources(from,to);
  else if(/\.(mjs|js|css|html|json|md|svg)$/.test(entry.name))fs.copyFileSync(from,to);
 }
}
try{
 for(const directory of ['lib','scripts','dashboard','tests','checks','config'])copySources(path.join(root,directory),path.join(fixture,directory));
 for(const file of ['package.json','playwright.config.mjs','README.md'])fs.copyFileSync(path.join(root,file),path.join(fixture,file));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(MOJE_GWO|GITLAB)_/i.test(key)));
 for(const environment of environments) {
  console.log('\nKontrole lokalne — '+environment.toUpperCase());
  const child=spawn(process.execPath,['--test',...groups[environment].map(name=>'checks/'+name+'.test.mjs')],
    {cwd:fixture,windowsHide:true,stdio:'inherit',env:{...env,MOJE_GWO_ENV:environment,MOJE_GWO_RUN_CONFIG:'',MOJE_GWO_PROFILE_ID:''}});
  const code=await new Promise(resolve=>{child.once('error',error=>{console.error(error.message);resolve(1);});child.once('exit',code=>resolve(code??1));});
  if(code)process.exitCode=1;
 }
}finally{
 const target=path.resolve(fixture);
 if(path.dirname(target)!==path.resolve(parent)||!path.basename(target).startsWith('checks-'))throw new Error('Nieprawidłowy folder kontroli lokalnych.');
 fs.rmSync(target,{recursive:true,force:true,maxRetries:3});
}
