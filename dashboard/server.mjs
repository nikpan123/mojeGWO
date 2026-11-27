import http from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {root,parseEnvironment} from '../lib/environment.mjs';
export {createDashboard,readiness} from './environment-server.mjs';

// Each environment runs the same shared code with its own process settings.
// Keeping that context immutable prevents a running test or timer from switching accounts.
export async function createApplication({defaultEnvironment='test'}={}) {
  const selected=parseEnvironment(defaultEnvironment),workers=new Map(),pending=new Map();
  let closing=false;
  async function backend(environment) {
    if(closing)throw new Error('Panel jest zamykany.');
    if(workers.has(environment))return workers.get(environment);
    if(pending.has(environment))return pending.get(environment);
    const promise=new Promise((resolve,reject)=>{
      const child=fork(path.join(root,'dashboard/worker.mjs'),[],{cwd:root,windowsHide:true,stdio:['ignore','inherit','inherit','ipc'],env:{...process.env,MOJE_GWO_ENV:environment,MOJE_GWO_RUN_CONFIG:'',MOJE_GWO_PROFILE_ID:''}});
      const timeout=setTimeout(()=>{child.kill();reject(new Error('Nie uruchomiono środowiska.'));},15000);
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.once('exit',()=>{clearTimeout(timeout);workers.delete(environment);pending.delete(environment);reject(new Error('Proces środowiska został zamknięty.'));});
      child.once('message',message=>{clearTimeout(timeout);const worker={child,port:message.port};workers.set(environment,worker);resolve(worker);});
    });
    pending.set(environment,promise);
    try{return await promise;}finally{pending.delete(environment);}
  }
  const server=http.createServer(async(req,res)=>{
    const origin='http://127.0.0.1:'+server.address().port;
    if(req.headers.host!==new URL(origin).host){res.writeHead(403);return res.end('Panel jest dostępny tylko lokalnie.');}
    const url=new URL(req.url,origin);
    if(req.method==='GET'&&url.pathname==='/'){res.writeHead(302,{Location:'/'+selected+'/'});return res.end();}
    const match=url.pathname.match(/^\/(test|prod)(\/.*)?$/);
    if(!match){res.writeHead(404);return res.end('Nie znaleziono.');}
    if(!match[2]){res.writeHead(302,{Location:'/'+match[1]+'/'});return res.end();}
    if(req.method!=='GET'&&req.headers.origin!==origin){res.writeHead(403);return res.end('Odśwież panel przed wykonaniem operacji.');}
    try {
      const worker=await backend(match[1]);
      const backendOrigin='http://127.0.0.1:'+worker.port;
      const headers={...req.headers,host:new URL(backendOrigin).host};
      if(headers.origin)headers.origin=backendOrigin;
      const proxy=http.request(backendOrigin+match[2]+url.search,{method:req.method,headers},response=>{
        res.writeHead(response.statusCode,response.headers);response.pipe(res);
      });
      proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Środowisko jest niedostępne.');});
      req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
    } catch {res.writeHead(503);res.end('Nie można uruchomić wybranego środowiska.');}
  });
  server.on('close',()=>{closing=true;for(const {child} of workers.values())child.kill();for(const promise of pending.values())void promise.then(({child})=>child.kill(),()=>{});});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),index=args.indexOf('--env');
  const selected=index>=0?args[index+1]:process.env.MOJE_GWO_ENV||'test';
  const server=await createApplication({defaultEnvironment:selected});
  server.listen(4182,'127.0.0.1',()=>console.log('moje.gwo — wybierz TEST lub PROD: http://127.0.0.1:4182'));
}
