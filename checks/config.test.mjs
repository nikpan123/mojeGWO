import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSettings, validateSettings, assertSafeURL } from '../lib/settings.mjs';

test('przykład dotyczy wyłącznie środowiska TEST', () => {
  assert.equal(validateSettings(readSettings()).environment, 'test');
});
test('produkcja, podszywające się domeny i HTTP są blokowane', () => {
  const settings = readSettings();
  settings.allowedHosts.push('moje.gwo.pl');
  for (const url of ['https://moje.gwo.pl', 'https://moje.gwotest.pl.evil.example', 'http://moje.gwotest.pl', 'https://moje.gwotest.pl:444']) {
    assert.throws(() => assertSafeURL(url, settings));
  }
});
test('dev nie jest obsługiwany', () => {
  assert.throws(() => validateSettings({ ...readSettings(), environment: 'dev' }));
});
test('wspólny GitLab SSO wymaga jawnego dopuszczenia; produkcja moje.gwo nadal jest blokowana', () => {
  const settings = readSettings();
  settings.allowedHosts = ['moje.gwotest.pl'];
  assert.throws(() => assertSafeURL('https://gitlab.gwo.pl/users/sign_in', settings));
  settings.allowedHosts.push('gitlab.gwo.pl', 'moje.gwo.pl');
  assert.equal(assertSafeURL('https://gitlab.gwo.pl/users/sign_in', settings).hostname, 'gitlab.gwo.pl');
  assert.throws(() => assertSafeURL('https://moje.gwo.pl', settings));
  assert.throws(() => assertSafeURL('https://gitlab.gwo.pl.evil.example', settings));
});
test('niekompletny szkielet nie udaje gotowego testu', () => {
  const settings = readSettings();
  settings.authenticatedUserSelector = '';
  assert.throws(() => validateSettings(settings, { complete: true }), /Uzupełnij/);
});
