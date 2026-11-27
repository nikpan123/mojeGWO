export function readableTestName(title,config={}){
 const text=String(title||''),functional=text.match(/^HC-(0[123])(?:\/([^ ]+))?(?: — (.*))?$/);
 if(functional){
  const [,code,id,description]=functional;
  if(code==='01')return 'Konto nauczyciela'+(config.profileLabel||config.accountDisplayName?' — '+(config.profileLabel||config.accountDisplayName):' — logowanie i sesja');
  const resource=(config.resources||[]).find(resource=>resource.id===id);
  const name=resource?.title||(code==='02'?description?.replace(/^nauczyciel ma aktywny dostęp:\s*/,''):null);
  return (code==='02'?'Sprawdzenie dostępu':'Sprawdzenie działania')+(name?' — '+name:' materiału');
 }
 const service=text.match(/^EP-\d+\/([^ ]+) — (.*)$/);
 if(service){const name=config.serviceHealth?.services?.find(item=>item.id===service[1])?.name;return service[2]+(name?' — '+name:' — healthcheck usługi');}
 return text.replace(/^WEB-\d+\/[^ ]+ — /,'').replace('dostępność strony','dostępność ekranu wejścia');
}
