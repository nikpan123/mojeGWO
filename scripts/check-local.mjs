import {spawn} from 'node:child_process';
import {root,parseEnvironment} from '../lib/environment.mjs';
const args=process.argv.slice(2),index=args.indexOf('--env');
const environments=index>=0?[parseEnvironment(args[index+1])]:['test','prod'];
const groups={test:['config','dashboard','load-testing','environment','panel-ui'],prod:['prod-draft','local-schedule','mattermost']};
for(const environment of environments) {
  console.log('\nKontrole lokalne — '+environment.toUpperCase());
  const child=spawn(process.execPath,['--test',...groups[environment].map(name=>'checks/'+name+'.test.mjs')],
    {cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,MOJE_GWO_ENV:environment,MOJE_GWO_RUN_CONFIG:'',MOJE_GWO_PROFILE_ID:''}});
  const code=await new Promise(resolve=>{child.once('error',error=>{console.error(error.message);resolve(1);});child.once('exit',code=>resolve(code??1));});
  if(code)process.exitCode=1;
}
