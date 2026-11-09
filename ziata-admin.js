(async()=>{const c=await ziataContext(),area=document.getElementById('employees'),message=document.getElementById('admin-message');if(!c.profile?.is_admin||c.profile.status!=='approved'){location.replace('/ZIATA/index.html');return}const keys=Object.keys(ziataNames);const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));const search=document.getElementById("zi-admin-search"),filter=document.getElementById("zi-admin-filter");function applyFilter(){const q=(search.value||"").trim().toLowerCase(),st=filter.value;area.querySelectorAll(".zi-admin-item").forEach(el=>{el.hidden=!(el.dataset.search.includes(q)&&(st==="all"||el.dataset.status===st));});}search.addEventListener("input",applyFilter);filter.addEventListener("change",applyFilter);async function load(){const {data:people,error}=await ziataSB.from('profiles').select('id,full_name,department,avatar_path,status,is_admin,created_at').order('created_at',{ascending:false});if(error){message.textContent=error.message;return}const {data:permissions}=await ziataSB.from('user_permissions').select('user_id,system_key,can_access');area.replaceChildren();for(const p of people||[]){const el=document.createElement('section');el.className='zi-admin-item';el.dataset.search=(p.full_name||'').toLowerCase()+' '+p.id.toLowerCase();el.dataset.status=p.status;el.innerHTML='<div class="zi-employee-summary"><div class="zi-employee-avatar" aria-hidden="true">👤</div><div class="zi-employee-info"><h3>'+escape(p.full_name||'بێ ناڤ')+(p.is_admin?' <span class="zi-employee-admin">Admin</span>':'')+'</h3><div class="zi-employee-metadata"><span><b>بەش:</b> '+escape(p.department||'نەهاتیە دیارکرن')+'</span><span><b>بارێ حسابێ:</b> '+escape(p.status||'—')+'</span><span><b>رۆژا تۆمارکرنێ:</b> '+escape(p.created_at?new Date(p.created_at).toLocaleDateString('en-GB'):'—')+'</span></div><small title="'+escape(p.id)+'">ID: '+escape(p.id)+'</small></div></div><div class="zi-permission-grid">'+keys.map(k=>'<label><input type="checkbox" data-key="'+k+'" '+((permissions||[]).some(x=>x.user_id===p.id&&x.system_key===k&&x.can_access)?'checked':'')+' '+(p.is_admin?'disabled':'')+'>'+ziataNames[k]+'</label>').join('')+'</div><div><button data-action="approved">پەسەندکرن</button><button data-action="rejected">رەتکرن</button><button data-action="suspended">راگرتن</button><button data-action="save">پاراستنا دەستهەلاتان</button></div>';el.querySelectorAll('button').forEach(b=>{if(p.is_admin)b.disabled=true;b.onclick=async()=>{const action=b.dataset.action;if(action==='save'){const rows=[...el.querySelectorAll('input[data-key]')].map(x=>({user_id:p.id,system_key:x.dataset.key,can_access:x.checked}));const {error}=await ziataSB.from('user_permissions').upsert(rows,{onConflict:'user_id,system_key'});message.textContent=error?error.message:'دەستهەلات هاتنە پاراستن'}else if(action==='approved'||action==='rejected'){
 b.disabled=true;message.textContent='رەوشا حسابێ دهێتە گۆڕین و ئیمێل دهێتە هنارتن…';
 try{
  const {data,error}=await ziataSB.functions.invoke('ziata-account-decision',{body:{user_id:p.id,status:action}});
  if(error)throw error;
  if(data?.error)throw Error(data.error);
  if(data?.already_set)message.textContent='رەوشا حسابێ ژ بەری وەسا بوو؛ ئیمێلێ نوی نەهاتە هنارتن.';
  else if(data?.changed&&data?.email_sent)message.textContent='حساب هاتە گۆڕین و ئیمێل بتنێ بۆ فەرمانبەری هاتە هنارتن.';
  else if(data?.changed)message.textContent='حساب هاتە گۆڕین، بەلێ ئیمێل نەهاتە هنارتن؛ پشکنینا Resend بکە.';
  else message.textContent='وەڵاما سێرڤەرێ نەهاتە پشتڕاستکرن.';
  if(data?.changed||data?.already_set)await load();
 }catch(e){message.textContent='نەشیا کردارێ تەمام بکەت: '+(e.message||e)+'. Supabase Edge Function و Resend پشکنە.'}
 finally{b.disabled=false}
}else{
 const {error}=await ziataSB.from('profiles').update({status:action}).eq('id',p.id);
 message.textContent=error?'خەلەتی: '+error.message:'دۆخ هاتە گۆڕین';
 if(!error)await load();
}}});area.appendChild(el);
if(p.avatar_path){
 const avatar=el.querySelector('.zi-employee-avatar');
 ziataSB.storage.from('avatars').createSignedUrl(p.avatar_path,3600).then(({data,error})=>{
   if(error||!data?.signedUrl||!avatar.isConnected)return;
   const photo=document.createElement('img');
   photo.alt='وێنەیێ پروفایلێ '+(p.full_name||'فەرمانبەری');
   photo.loading='lazy';
   photo.decoding='async';
   photo.src=data.signedUrl;
   photo.onerror=()=>{photo.remove();avatar.textContent='👤'};
   avatar.replaceChildren(photo);
 }).catch(()=>{});
}
}applyFilter()}await load()})();
// Read-only recent administrative audit events; available after V35 SQL migration.
(()=>{const b=document.getElementById('zi-load-logs'),out=document.getElementById('zi-logs');if(!b||!out)return;b.addEventListener('click',async()=>{out.textContent='چاوەڕێ بکە...';const {data,error}=await ziataSB.from('ziata_activity_logs').select('created_at,actor_id,target_user_id,event_type,details').order('created_at',{ascending:false}).limit(50);if(error){out.textContent=error.message;return}out.replaceChildren();for(const item of data||[]){const d=document.createElement('div');d.className='zi-log-row';const when=new Date(item.created_at).toLocaleString();d.textContent=when+' · '+item.event_type+' · '+(item.target_user_id||'')+' · '+JSON.stringify(item.details||{});out.appendChild(d)}if(!data?.length)out.textContent='تۆمار نینن'});})();
