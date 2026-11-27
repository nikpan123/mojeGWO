export function teacherController({store,vault,inspect}){
 return {
  async state(){const data=store.read(),base=store.baseProvider();return {revision:data.revision,selectedId:data.selectedId,templates:base.resources||[],teachers:await Promise.all(data.teachers.map(async teacher=>({...teacher,credentialStatus:teacher.credentialMode==='env'?{source:'env'}:{source:'vault',...await vault.status(teacher.id)}})))};},
  async change(action,input){
   if(action==='save'){
    if(!input.teacher||typeof input.teacher!=='object')throw Object.assign(new Error('Brak danych nauczyciela.'),{status:400});
    const c=input.credentials||{};for(const key of ['portalPassword','gitlabPassword','gitlabLogin'])if(c[key]!==undefined&&(typeof c[key]!=='string'||c[key].length>2000))throw Object.assign(new Error('Nieprawidłowe dane logowania.'),{status:400});
    return {id:await store.save(input,(...args)=>vault.save(...args))};
   }
   if(action==='select'){await store.select(input);return {};}
   if(action==='archive'){await store.archive(input);return {};}
   if(action==='resource'){if(!input.removeId&&!input.resource)throw Object.assign(new Error('Brak danych materiału.'),{status:400});await store.resource(input);return {};}
   if(action==='inspect'){
    const teacher=store.read().teachers.find(t=>t.id===input.id);if(!teacher?.enabled)throw Object.assign(new Error('Wybierz aktywnego nauczyciela.'),{status:400});
    if(input.revision!==store.read().revision)throw Object.assign(new Error('Odśwież profil przed odczytem konta.'),{status:409});
    let result;try{result=await inspect(store.settings(input.id));}catch(e){throw Object.assign(new Error(e.name==='AuthenticationError'?e.message:'Nie udało się odczytać konta i materiałów. Sprawdź dane logowania, domeny i brak drugiego logowania na to konto.'),{status:409});}
    await store.imported(input.id,result);return {id:input.id,count:result.materials.length};
   }
   throw Object.assign(new Error('Nie znaleziono operacji.'),{status:404});
  }
 };
}
