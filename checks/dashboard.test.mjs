import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createDashboard } from '../dashboard/server.mjs';

test('panel pokazuje brak konfiguracji, pięć testów i blokuje uruchomienie', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mojegwo-panel-'));
  const server = await createDashboard({ dataDir: dir, checkReadiness: async () => ({ready:false,message:'Uzupełnij konfigurację konta testowego.'}) });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const state = await (await fetch(origin + '/api/state')).json();
    assert.equal(state.scenarios.filter(s=>s.file==='tests/health.spec.mjs').length,5);assert.equal(state.scenarios.filter(s=>s.file==='tests/service-health.spec.mjs').length,9);assert.equal(state.scenarios.filter(s=>s.type==='manual').length,24);
    assert.equal(state.ready, false);
    assert.deepEqual(state.history, []);
    const response = await fetch(origin);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors http:\/\/127.0.0.1:4180/);
    const html = await response.text();
    assert.match(html, /Wymaga konfiguracji/);
    const token = html.match(/name="health-token" content="([^"]+)"/)[1];
    const wrongOrigin = await fetch(origin + '/api/run', { method: 'POST', headers: { Origin: 'https://example.com', 'X-Health-Token': token } });
    assert.equal(wrongOrigin.status, 403);
    const run = await fetch(origin + '/api/run', { method: 'POST', headers: { Origin: origin, 'X-Health-Token': token } });
    assert.equal(run.status, 409);
    assert.match((await run.json()).error, /Uzupełnij/);
    assert.equal((await fetch(origin + '/playwright/.auth/teacher.json')).status, 404);
    assert.equal((await fetch(origin + '/report/00000000-0000-0000-0000-000000000000/%2e%2e%2fsecret')).status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
