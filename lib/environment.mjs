import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function parseEnvironment(value='test') {
  const selected=String(value).toLowerCase();
  if(!['test','prod'].includes(selected))throw new Error('Wybierz środowisko test albo prod.');
  return selected;
}
export const environment=parseEnvironment(process.env.MOJE_GWO_ENV);
export const root=fileURLToPath(new URL('../',import.meta.url));
export const dataRoot=path.join(root,'.health',environment);
export const envFile=path.join(root,'.env.'+environment);
