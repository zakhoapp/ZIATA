(()=>{'use strict';
const publicKey=window.ZIATA_PUSH_PUBLIC_KEY;
const supported=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
const decode=(key)=>{const pad='='.repeat((4-key.length%4)%4);const raw=atob((key+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
async function subscribe(){
 if(!supported())throw Error('Push Notification ل ڤی براوسەری نەهاتیە پشتگیریکرن.');
 if(!publicKey)throw Error('VAPID public key هێشتا نەهاتیە ڕێکخستن.');
 const c=await window.ziataContext();if(!c.session||c.profile?.status!=='approved')throw Error('پێدڤیە ب حسابەکێ پەسەندکری Login بکەی.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('رێپێدانا ئاگەهداریان نەهاتە دان.');
 const reg=await navigator.serviceWorker.register('/ZIATA/sw.js',{scope:'/ZIATA/'});await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(sub){const oldKey=sub.options?.applicationServerKey; if(oldKey&&btoa(String.fromCharCode(...new Uint8Array(oldKey))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')!==publicKey){await sub.unsubscribe();sub=null;}}
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(publicKey)});
 const payload=sub.toJSON();const {error}=await window.ziataSB.from('ziata_push_subscriptions').upsert({user_id:c.session.user.id,endpoint:payload.endpoint,subscription:payload,updated_at:new Date().toISOString()},{onConflict:'endpoint'});if(error)throw error;
 return true;
}
async function send(title,body){
 const c=await window.ziataContext();if(!c.profile?.is_admin||c.profile.status!=='approved')throw Error('بتنێ Admin دشێت ئاگەهداریێ بفرێکەت.');
 const {data:{session}}=await window.ziataSB.auth.getSession();
 const res=await fetch(window.ZIATA_SUPABASE.url+'/functions/v1/ziata-broadcast',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':window.ZIATA_SUPABASE.key},body:JSON.stringify({title,body})});
 const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||('HTTP '+res.status));return data;
}
window.ZIATAPush={subscribe,send,supported};
window.addEventListener('ziata-ready',()=>{
 const btn=document.getElementById('zi-push-enable'),msg=document.getElementById('zi-push-status');if(!btn)return;
 if(!supported()){btn.disabled=true;msg.textContent='ئەڤ براوسەرە پشتگیرییا Push ناکەت.';return;}
 btn.onclick=async()=>{btn.disabled=true;msg.textContent='چاوەڕێ بکە...';try{await subscribe();msg.textContent='ئاگەهداریێن مۆبایلێ چالاک بوون ✓';}catch(e){msg.textContent=e.message;}finally{btn.disabled=false;}};
});
})();
