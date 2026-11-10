(()=>{'use strict';
const el=document.getElementById('zi-signup-notices'),count=document.getElementById('zi-signup-count');
if(!el)return;
let running=false;
async function refresh(){
 if(running)return;running=true;
 try{
  const c=await window.ziataContext();
  if(!c.profile?.is_admin||c.profile.status!=='approved')return;
  const sb=window.ziataSB;
  const [{data:notes,error:ne},{data:pending,error:pe}]=await Promise.all([
   sb.from('ziata_signup_notifications').select('id,user_id,full_name,created_at,is_read').order('created_at',{ascending:false}).limit(500),
   sb.from('profiles').select('id').eq('status','pending').limit(2000)
  ]);
  if(ne)throw ne;if(pe)throw pe;
  const pendingIds=new Set((pending||[]).map(x=>x.id));
  const visible=notes||[];
  count.textContent=String(visible.length);
  el.replaceChildren();
  if(!visible.length){el.textContent='هێشتا ئاگەهداریەکا تۆمارکرنا حسابێ نوی نینە';return}
  for(const n of visible){
   const item=document.createElement('div');item.className='zi-signup-row';
   const a=document.createElement('a');a.href='#employees';a.textContent='👤 '+(n.full_name||'فەرمانبەرێ نوی')+' · '+(pendingIds.has(n.user_id)?'چاوەڕێی پەسەندکرنێ':'هاتە چارەسەرکرن')+' — '+new Date(n.created_at).toLocaleString();
   a.addEventListener('click',async()=>{await sb.from('ziata_signup_notifications').update({is_read:true}).eq('id',n.id);const f=document.getElementById('zi-admin-filter');if(f){f.value='pending';f.dispatchEvent(new Event('change'))}});
   item.append(a);el.append(item);
  }
 }catch(e){el.textContent='خەلەتی: '+(e.message||e)}
 finally{running=false}
}
window.addEventListener('ziata-ready',refresh);
document.addEventListener('ziata-users-updated',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden)refresh()},30000);
refresh();
})();
