import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);

// Only accepts the ChildProcess kept by the panel, never a PID from a request.
export async function stopTestProcess(child){
 if(!Number.isSafeInteger(child?.pid)||child.pid<=0)throw new Error('Brak procesu testowego.');
 if(child.exitCode!=null||child.signalCode!=null)return;
 if(process.platform==='win32'){
  await execute('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:15000});
 }else{
  // Test runners are launched in their own process group on Unix.
  try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
 }
}
