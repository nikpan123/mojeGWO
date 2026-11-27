import {ensureSession} from '../lib/auth.mjs';
import {writeEvent} from '../dashboard/live-reporter.mjs';
export default async function(){
  writeEvent('auth','Sprawdzanie sesji i logowanie');
  const summary=await ensureSession();
  writeEvent('auth','Potwierdzono konto i rolę nauczyciela');
  console.log(`Logowanie TEST: ${summary.mode} — potwierdzono konto i rolę nauczyciela.`);
}
