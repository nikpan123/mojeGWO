// Normalna obsługa banera, bez usuwania elementów DOM i bez zgód opcjonalnych.
export async function necessaryCookiesOnly(page){
  const overlay=page.locator('[class^="overlay-cookie-uuid"]');
  const preference=(await page.context().cookies()).some(c=>c.name==='gwo-cookie-consent');
  if(preference&&!await overlay.isVisible())return false;
  if(!await overlay.waitFor({state:'visible',timeout:2000}).then(()=>true,()=>false))return false;
  await overlay.getByRole('button',{name:'Ustawienia zaawansowane',exact:true}).click();
  const options=overlay.locator('input[type="checkbox"]:enabled');
  for(let i=0;i<await options.count();i++){
    const option=options.nth(i);
    if(await option.isChecked())await option.locator('..').click();
    if(await option.isChecked())throw new Error('Nie udało się wyłączyć opcjonalnej kategorii cookies.');
  }
  await overlay.getByRole('button',{name:'Potwierdzenie moich wyborów',exact:true}).click();
  await overlay.waitFor({state:'hidden',timeout:10000});
  return true;
}
