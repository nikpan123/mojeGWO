import fs from 'node:fs/promises';
import path from 'node:path';
export async function startPreview(context,settings,{directory=process.env.MOJE_GWO_LIVE_DIR,enabled=process.env.MOJE_GWO_PREVIEW==='1',interval=900}={}) {
 if(!directory||!enabled)return async()=>{};
 let busy=false,stopped=false;
 const portal=new URL(settings.baseURL);
 async function capture(){
  if(busy||stopped)return;busy=true;
  try{
   const page=[...context.pages()].reverse().find(page=>{
    if(page.isClosed())return false;
    try{const u=new URL(page.url());return u.protocol==='https:'&&settings.allowedHosts.includes(u.hostname)&&((u.origin===portal.origin&&u.pathname===settings.catalogPath)||u.hostname.includes('.apps.'));}catch{return false;}
   });
   if(!page||await page.locator('input[type=password],input[name=password],#user_password').count())return;
   const bytes=await page.screenshot({type:'jpeg',quality:82,timeout:1800,animations:'disabled',mask:[page.locator('input[type=password],input[name=password],#user_password')]});
   // Odrzuć obraz, jeśli podczas robienia zrzutu nastąpiło przekierowanie do formularza.
   if(await page.locator('input[type=password],input[name=password],#user_password').count())return;
   await fs.mkdir(directory,{recursive:true});
   await fs.writeFile(path.join(directory,'preview.jpg.pending'),bytes);
   await fs.rename(path.join(directory,'preview.jpg.pending'),path.join(directory,'preview.jpg'));
  }catch{}finally{busy=false;}
 }
 const timer=setInterval(capture,interval);timer.unref();
 return async()=>{clearInterval(timer);await capture();stopped=true;while(busy)await new Promise(r=>setTimeout(r,20));};
}
