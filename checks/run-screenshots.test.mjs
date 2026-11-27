import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createDashboard} from '../dashboard/environment-server.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('galeria udostępnia zrzuty raportu i podgląd, bez ścieżek lokalnych i dostępu poza przebieg',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'gwo-gallery-'));let server;
 try{
  const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',run=path.join(directory,'runs',id),file=path.join(run,'artifacts','screen.png');
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.mkdir(path.join(run,'live'));
  await fs.writeFile(file,Buffer.from(png,'base64'));await fs.writeFile(path.join(run,'live','preview.jpg'),Buffer.from(png,'base64'));
  const outside=path.join(directory,'private.png');await fs.writeFile(outside,'private');
  await fs.writeFile(path.join(directory,'history.json'),JSON.stringify([{id,status:'PASS'}]));
  await fs.writeFile(path.join(run,'config.json'),JSON.stringify({resources:[{id:'reader',title:'Podręcznik przykładowy'}]}));
  await fs.writeFile(path.join(run,'results.json'),JSON.stringify({suites:[{specs:[{title:'HC-03/reader — otwarcie i podstawowa funkcja',tests:[{results:[{status:'passed',attachments:[{name:'ekran-aplikacji',contentType:'image/png',body:png},{name:'screenshot',contentType:'image/png',path:file},{name:'outside',contentType:'image/png',path:outside},{name:'relative-outside',contentType:'image/png',path:'../../private.png'},{name:'unsafe-type',contentType:'image/svg+xml',body:'PHN2Zz4='}]}]}]}]}]}));
  server=await createDashboard({dataDir:directory,checkReadiness:async()=>({ready:false,message:'Przykład'})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,base=origin+'/api/runs/'+id+'/screenshots';
  const response=await fetch(base),gallery=await response.json();assert.equal(response.status,200);assert.equal(gallery.screenshots.length,3);
  assert.match(gallery.screenshots[0].testTitle,/Podręcznik przykładowy/);assert.equal(gallery.screenshots[0].label,'Ekran aplikacji');
  assert.ok(!JSON.stringify(gallery).includes(directory));assert.ok(gallery.screenshots.every(image=>!('body' in image)&&!('file' in image)));
  for(const index of [0,1]){const image=await fetch(base+'/'+index);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png,'base64'));}
  assert.equal((await fetch(base+'/99')).status,404);assert.equal((await fetch(origin+'/api/runs/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/screenshots')).status,404);
  await fs.rm(path.join(run,'results.json'));const fallback=await(await fetch(base)).json();assert.equal(fallback.screenshots.length,1);
  await fs.rm(path.join(run,'live','preview.jpg'));assert.deepEqual((await(await fetch(base)).json()).screenshots,[]);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});}
});
