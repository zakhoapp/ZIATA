(()=>{'use strict';const $=id=>document.getElementById(id),table='ziata_professional_entries';let uid='',editId=null,records=[],started=false;
const msg=(s,bad=false)=>{$('message').textContent=s;$('message').classList.toggle('error',bad)};
const text=(tag,t)=>{const n=document.createElement(tag);n.textContent=t;return n};
function clear(){editId=null;$('profile-form').reset();$('form-title').textContent='زێدەکرنا تۆمارەکا نوی'}
function render(){const box=$('entries');box.replaceChildren();if(!records.length){box.append(text('p','هێشتا تۆمارەک نەهاتیە زێدەکرن.'));return}
for(const r of records){const card=document.createElement('article');card.className='entry';card.append(text('h3',(r.entry_type==='project'?'پرۆژە: ':'لێژنە: ')+r.title));
card.append(text('p',[r.role_name,r.project_name,r.start_date,r.end_date,r.work_status].filter(Boolean).join(' · ')));
if(r.notes)card.append(text('p',r.notes));
const actions=document.createElement('div');actions.className='actions';const edit=text('button','دەستکاری');edit.className='secondary';edit.onclick=()=>{editId=r.id;$('entry-type').value=r.entry_type;$('entry-title').value=r.title;$('entry-role').value=r.role_name||'';$('entry-project').value=r.project_name||'';$('entry-start').value=r.start_date||'';$('entry-end').value=r.end_date||'';$('entry-status').value=r.work_status||'active';$('entry-notes').value=r.notes||'';$('form-title').textContent='دەستکاریکرنا تۆمارێ';window.scrollTo({top:0,behavior:'smooth'})};
const del=text('button','ژێبرن');del.className='danger';del.onclick=async()=>{if(!confirm('دڵنیایی ژ ژێبرنا ڤێ تۆمارێ؟'))return;del.disabled=true;const {error}=await window.ziataSB.from(table).delete().eq('id',r.id).eq('user_id',uid);if(error){msg(error.message,true);del.disabled=false}else await load()};
actions.append(edit,del);card.append(actions);box.append(card)}}
async function load(){const {data,error}=await window.ziataSB.from(table).select('*').eq('user_id',uid).order('created_at',{ascending:false});if(error)throw error;records=data||[];render();msg('تۆمارێن تە هاتنە بارکرن.')}
async function init(){if(started)return;started=true;try{const ctx=await window.ziataContext();uid=ctx.session?.user?.id;if(!uid||ctx.profile?.status!=='approved'){msg('پێدڤیە ب حسابێ پەسەندکری بچیە ژوور.',true);return}
$('editor').hidden=false;$('cancel').onclick=clear;
$('profile-form').onsubmit=async e=>{e.preventDefault();const start=$('entry-start').value||null,end=$('entry-end').value||null;if(start&&end&&end<start){msg('بەروارا دوماهیێ بەری دەستپێکرنێ نابیت.',true);return}
const payload={entry_type:$('entry-type').value,title:$('entry-title').value.trim(),role_name:$('entry-role').value.trim(),project_name:$('entry-project').value.trim(),start_date:start,end_date:end,work_status:$('entry-status').value,notes:$('entry-notes').value.trim()};
$('save').disabled=true;try{const q=editId?window.ziataSB.from(table).update(payload).eq('id',editId).eq('user_id',uid):window.ziataSB.from(table).insert({...payload,user_id:uid});const {error}=await q;if(error)throw error;clear();await load();msg('زانیاری ب سەرکەفتی هاتنە خەزنکرن.')}catch(err){msg(err.message,true)}finally{$('save').disabled=false}};
await load()}catch(err){msg('خەلەتی: '+err.message,true)}}
window.addEventListener('ziata-ready',init,{once:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();