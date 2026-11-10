(()=>{'use strict';
const $=id=>document.getElementById(id);
async function refresh(){
 const status=$('zi-push-stats-status'),list=$('zi-push-stats-list');
 if(!status)return;
 status.textContent='زانیاری دهێنە خوێندن...';
 try{
  const ctx=await window.ziataContext();
  if(!ctx.profile?.is_admin||ctx.profile.status!=='approved')return;
  const response=await fetch(window.ZIATA_SUPABASE.url+'/functions/v1/ziata-announcements',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+ctx.session.access_token,'apikey':window.ZIATA_SUPABASE.key},
   body:JSON.stringify({action:'push_stats'})
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'HTTP '+response.status);
  $('zi-push-stats-total').textContent=result.total;
  $('zi-push-stats-active').textContent=result.registered;
  $('zi-push-stats-inactive').textContent=result.unregistered;
  list.replaceChildren();
  for(const p of result.employees){
   const row=document.createElement('div');row.className='zi-push-stat-row';
   const name=document.createElement('span');name.textContent=p.full_name||'بێ ناڤ';
   const flag=document.createElement('strong');flag.textContent=p.push_registered?'● تۆمارکری':'○ تۆمارنەکری';
   flag.className=p.push_registered?'zi-push-stat-yes':'zi-push-stat-no';
   row.append(name,flag);list.append(row);
  }
  status.textContent='نویکری · تۆماربوونا ئامێران بتنێ، نە پشتڕاستکرنا گەهشتنا ئاگەهداریێ.';
 }catch(e){status.textContent='نەشیا ئاماران بخوینیت: '+e.message+' — پێدڤیە Edge Function نویکە بکەی.'}
}
const b=$('zi-push-stats-refresh');if(b)b.onclick=refresh;
window.addEventListener('ziata-ready',refresh);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
