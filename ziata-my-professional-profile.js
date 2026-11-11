(()=>{'use strict';
const $=id=>document.getElementById(id),table='ziata_professional_entries',source='ziata_committee_records';
let uid='',editId=null,officialEditId=null,records=[],started=false,projects=[],committees=[],official=[],unlinked=[];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const unique=arr=>[...new Map(arr.map(x=>[clean(x).toLocaleLowerCase(),clean(x)]).filter(x=>x[0])).values()].sort((a,b)=>a.localeCompare(b));
const msg=(s,bad=false)=>{$('message').textContent=s;$('message').classList.toggle('error',bad)};
const text=(tag,t)=>{const n=document.createElement(tag);n.textContent=t;return n};
const statusText=s=>({active:'بەردەوامە',completed:'تەمام بوویە',paused:'راوەستیایە'})[s]||s;
function updateChoices(value=''){
 const kind=$('entry-type').value,options=kind==='project'?projects:committees,choice=$('entry-choice');
 choice.replaceChildren(new Option('هەلبژێرە…',''),...options.map(x=>new Option(x,x)));
 if(kind==='project')choice.add(new Option('＋ پرۆژەیا من د لیستێ دا نینە — بنڤیسە','__custom__'));
 $('choice-hint').textContent=kind==='project'?'پرۆژەیێن هەڤالان ژ سیستەمێ لێژنان؛ ئەگەر نەبیت، ناڤێ نوی بنڤیسە.':'لێژنەیێن هەیی ژ سیستەمێ لێژنان هەلبژێرە.';
 if(value){
  const match=options.find(x=>clean(x).toLocaleLowerCase()===clean(value).toLocaleLowerCase());
  if(match)choice.value=match;else if(kind==='project'){choice.value='__custom__';$('entry-title').value=value;}
  else {choice.add(new Option(value+' (تۆمارا پێشتر)',value));choice.value=value;}
 }
 toggleCustom();
}
function toggleCustom(){const custom=$('entry-choice').value==='__custom__'&&$('entry-type').value==='project';$('custom-wrap').classList.toggle('hidden',!custom);$('entry-title').required=custom;if(!custom)$('entry-title').value=''}
function clear(){editId=null;officialEditId=null;$('profile-form').reset();$('form-title').textContent='زێدەکرنا تۆمارەکا نوی';updateChoices()}
function editOfficial(item){
 const existing=records.find(r=>r.entry_type===item.entry_type&&clean(r.title).toLocaleLowerCase()===clean(item.title).toLocaleLowerCase());
 editId=existing?.id||null;officialEditId=item.record_id||null;$('entry-type').value=item.entry_type;updateChoices(item.title);
 $('entry-role').value=existing?.role_name||'';$('entry-status').value=existing?.work_status||'active';$('entry-notes').value=existing?.notes||'';
 $('form-title').textContent='رەوشا '+item.title+' دەستکاری بکە';window.scrollTo({top:0,behavior:'smooth'});
}
function renderOfficial(){
 const box=$('official-entries');box.replaceChildren();
 if(!official.length&&!unlinked.length){box.append(text('p','هیچ تۆمارەک نەهاتە دیتن. ئەگەر د پروفایلێ سەرەکی دا تۆمار هەبن، پێدڤیە دەستهەلاتا خوێندنا خشتەیێ ب Supabase بهێتە پشکنین.'));return}
 for(const item of unlinked){const card=document.createElement('article');card.className='entry';card.append(text('h3',(item.entry_type==='project'?'پرۆژە: ':'لێژنە: ')+item.title));card.append(text('p','ب ناڤێ تە تۆمارکریە، بەلێ هێشتا ب حسابێ تە نەهاتیە گرێدان. بۆ دەستکاریکرنێ، ئەدمین پێدڤیە حسابێ تە گرێبدەت.'));box.append(card)}
 for(const item of official){const card=document.createElement('article');card.className='entry';card.append(text('h3',(item.entry_type==='project'?'پرۆژە: ':'لێژنە: ')+item.title));
 const match=records.find(r=>r.entry_type===item.entry_type&&clean(r.title).toLocaleLowerCase()===clean(item.title).toLocaleLowerCase());
 const badge=text('span',match?statusText(match.work_status):'فەرمی · رەوش نەهاتیە دیارکرن');badge.className='entry-status'+(match?.work_status==='completed'?' done':'');card.append(badge);
 const btn=text('button','دیارکرنا رۆل و رەوشێ');btn.type='button';btn.className='secondary';btn.onclick=()=>editOfficial(item);
 const actions=document.createElement('div');actions.className='actions';actions.append(btn);card.append(actions);box.append(card)}
}
function render(){renderOfficial();
 const box=$('entries');box.replaceChildren();
 if(!records.length){box.append(text('p','هێشتا تۆمارەک نەهاتیە زێدەکرن.'));return}
 for(const r of records){
  const card=document.createElement('article');card.className='entry';card.dataset.done=String(r.work_status==='completed');
  card.append(text('h3',(r.entry_type==='project'?'پرۆژە: ':'لێژنە: ')+r.title));
  const badge=text('span',statusText(r.work_status));badge.className='entry-status'+(r.work_status==='completed'?' done':'');card.append(badge);
  if(r.role_name)card.append(text('p','رۆلێ من: '+r.role_name));
  if(r.notes)card.append(text('p',r.notes));
  const actions=document.createElement('div');actions.className='actions';
  const edit=text('button','دەستکاری');edit.type='button';edit.className='secondary';edit.onclick=()=>{
   editId=r.id;$('entry-type').value=r.entry_type;updateChoices(r.title);
   $('entry-role').value=r.role_name||'';$('entry-status').value=r.work_status||'active';$('entry-notes').value=r.notes||'';
   $('form-title').textContent='دەستکاریکرنا تۆمارێ';window.scrollTo({top:0,behavior:'smooth'})
  };
  const del=text('button','ژێبرن');del.type='button';del.className='danger';del.onclick=async()=>{
   if(!confirm('دڵنیایی ژ ژێبرنا ڤێ تۆمارێ؟'))return;del.disabled=true;
   const {error}=await window.ziataSB.from(table).delete().eq('id',r.id).eq('user_id',uid);
   if(error){msg(error.message,true);del.disabled=false}else await load()
  };
  actions.append(edit,del);card.append(actions);box.append(card);
 }
}
async function fetchCatalog(){
 const rows=[];
 for(let offset=0;offset<20000;offset+=500){
  const {data,error}=await window.ziataSB.from(source).select('id,staff_name,employee_id,committee_type,projects_text').order('id').range(offset,offset+499);
  if(error)throw error;rows.push(...(data||[]));if(!data||data.length<500)break;
 }
 committees=unique(rows.flatMap(r=>String(r.committee_type||'').split(/\r?\n|؛|;/)));
 // Query linked records directly: avoids page limits and unrelated row policies.
 const linked=await window.ziataSB.from(source).select('id,staff_name,employee_id,committee_type,projects_text').eq('employee_id',uid);
 if(linked.error)throw new Error('نەشیا تۆمارێن ب UUID گرێدای بخوینیت: '+linked.error.message);
 const mine=linked.data||[];
 // Name matching is display-only: never authorize edits by name.
 // Exclude records explicitly linked to another account.
 const myName=clean(window.ziataMyFullName||'').toLocaleLowerCase();
 const unlinkedRows=myName?rows.filter(r=>!r.employee_id&&clean(r.staff_name).toLocaleLowerCase()===myName):[];
 const entriesOf=rr=>[...new Map(rr.flatMap(r=>[
 ...String(r.committee_type||'').split(/\\r?\\n|؛|;/).map(title=>({entry_type:'committee',title:clean(title),record_id:r.id})),
 ...String(r.projects_text||'').split(/\\r?\\n|؛|;/).map(title=>({entry_type:'project',title:clean(title),record_id:r.id}))
 ]).filter(x=>x.title).map(x=>[x.entry_type+':'+x.title.toLocaleLowerCase(),x])).values()];
 unlinked=entriesOf(unlinkedRows);
 official=[...new Map(mine.flatMap(r=>[
 ...String(r.committee_type||'').split(/\r?\n|؛|;/).map(title=>({entry_type:'committee',title:clean(title),record_id:r.id})),
 ...String(r.projects_text||'').split(/\r?\n|؛|;/).map(title=>({entry_type:'project',title:clean(title),record_id:r.id}))
 ]).filter(x=>x.title).map(x=>[x.entry_type+':'+x.title.toLocaleLowerCase(),x])).values()];
 projects=unique(rows.flatMap(r=>String(r.projects_text||'').split(/\r?\n|؛|;/)));
}
async function load(){
 const {data,error}=await window.ziataSB.from(table).select('*').eq('user_id',uid).order('created_at',{ascending:false});
 if(error)throw error;records=data||[];render();msg('تۆمارێن تە هاتنە بارکرن.')
}
async function init(){
 if(started||!window.ziataSB||!window.ziataContext)return;started=true;
 try{
  const ctx=await window.ziataContext();uid=ctx.session?.user?.id;
  if(!uid||ctx.profile?.status!=='approved'){msg('پێدڤیە ب حسابێ پەسەندکری بچیە ژوور.',true);return}
  window.ziataMyFullName=ctx.profile?.full_name||'';
  $('editor').hidden=false;
  $('entry-type').addEventListener('change',()=>updateChoices());
  $('entry-choice').addEventListener('change',toggleCustom);
  $('cancel').onclick=clear;
  try{await fetchCatalog()}catch(e){msg('نەشیا لیستا پرۆژە و لێژنان بار بکەت: '+e.message,true);$('official-entries').textContent='خەلەتییا بارکرنێ: '+e.message;return}
  updateChoices();
  $('profile-form').onsubmit=async e=>{
   e.preventDefault();
   const choice=$('entry-choice').value;
   const title=clean(choice==='__custom__'?$('entry-title').value:choice);
   if(title.length<2){msg('ناڤێ پرۆژە یان لێژنێ هەلبژێرە.',true);return}
   const payload={entry_type:$('entry-type').value,title,role_name:clean($('entry-role').value),work_status:$('entry-status').value,notes:clean($('entry-notes').value)};
   $('save').disabled=true;
   try{
    // Write the membership to the official committee table through a guarded RPC.
    // If this is an existing official record, preserve the other membership field.
    const siblings=official.filter(x=>x.record_id===officialEditId);
    const rpcPayload={p_action:officialEditId?'update':'create',p_record_id:officialEditId||null,
      p_committee:officialEditId?siblings.filter(x=>x.entry_type==='committee').map(x=>x.title).join('\\n'):(payload.entry_type==='committee'?title:''),
      p_projects:officialEditId?siblings.filter(x=>x.entry_type==='project').map(x=>x.title).join('\\n'):(payload.entry_type==='project'?title:''),
      p_notes:''};
    const officialWrite=await window.ziataSB.rpc('ziata_my_official_membership',rpcPayload);
    if(officialWrite.error)throw officialWrite.error;
    const existingPersonal=records.find(x=>x.entry_type===payload.entry_type&&clean(x.title).toLocaleLowerCase()===title.toLocaleLowerCase());
    const q=existingPersonal?window.ziataSB.from(table).update(payload).eq('id',existingPersonal.id).eq('user_id',uid):window.ziataSB.from(table).insert({...payload,user_id:uid});
    const {error}=await q;if(error)throw error;
    if(payload.entry_type==='project')projects=unique([...projects,title]);
    clear();await fetchCatalog();await load();msg('تۆمارا فەرمی و رەوشا تە هاتنە خەزنکرن.')
   }catch(err){msg(err.message,true)}finally{$('save').disabled=false}
  };
  await load()
 }catch(err){msg('خەلەتی: '+err.message,true)}
}
window.addEventListener('ziata-ready',init,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();