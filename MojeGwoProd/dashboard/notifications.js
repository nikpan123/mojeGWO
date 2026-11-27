(()=>{
 const $=s=>document.querySelector(s),form=$('#notifications-form');let state=null,dirty=false,pending=false;
 form.addEventListener('input',()=>dirty=true);
 async function change(url,body){pending=true;try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Health-Token':$('meta[name=health-token]').content},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);dirty=false;$('#notifications-message').textContent=url.endsWith('/test')?(result.delivery.status==='SENT'?'Wysłano wiadomość kontrolną.':'Nie udało się wysłać wiadomości. Sprawdź webhook i uprawnienia. '):'Zapisano ustawienia.';await window.refreshMojeGwo?.();}catch(e){$('#notifications-message').textContent=e.message;}finally{pending=false;}}
 form.onsubmit=e=>{e.preventDefault();void change('/api/notifications',{enabled:form.elements.enabled.checked,mention:form.elements.mention.value,revision:state.revision});};
 $('#notifications-test').onclick=()=>change('/api/notifications/test',{});
 window.renderNotifications=s=>{if(!s.notifications)return;state=s.notifications;if(!dirty){form.elements.enabled.checked=state.enabled;form.elements.mention.value=state.mention;}
 $('#notifications-status').textContent=state.webhookConfigured?'Webhook ustawiony lokalnie. '+(state.enabled?'Powiadomienia o niezaliczonych przebiegach są włączone.':'Powiadomienia są wyłączone.'):'Brak webhooka. Uzupełnij MOJE_GWO_MATTERMOST_WEBHOOK_URL w pliku .env projektu MojeGwoProd.';
 $('#notifications-last').textContent=state.lastDelivery?'Ostatnia wysyłka: '+(state.lastDelivery.status==='SENT'?'wysłano':'nie wysłano')+' · '+new Date(state.lastDelivery.at).toLocaleString('pl-PL'):'Nie wysyłano jeszcze wiadomości.';
 $('#notifications-test').disabled=pending||dirty||!state.webhookConfigured;
 form.querySelector('[type=submit]').disabled=pending;
 };
})();
