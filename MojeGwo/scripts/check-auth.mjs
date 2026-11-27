import {ensureSession} from '../lib/auth.mjs';
try{
  const summary=await ensureSession({forceFresh:process.argv.includes('--force')});
  console.log(`Logowanie TEST zakończone: ${summary.mode}. Konto i rola nauczyciela potwierdzone.`);
}catch(error){console.error(error.message);process.exitCode=1;}
