(()=>{'use strict';const $=id=>document.getElementById(id);let records=[],started=false;
const labels={announcement:'ئاگەهداری',leave:'مولەت',letter:'نڤیسار'};
function render(){const q=$('search').value.trim().toLocaleLowerCase(),body=$('rows');body.replaceChildren();
const filtered=records.filter(r=>[r.recipient_name,r.title,r.detail,r.source_id].some(v=>String(v||'').toLocaleLowerCase().includes(q)));
$('status').textContent=filtered.length+' تۆمار نیشان دهێنە دان (زۆرترین 1000 تۆمار)';
for(const r of filtered){const tr=document.createElement('tr');
const cells=[labels[r.source_type]||r.source_type,r.recipient_name||r.recipient_id,r.title||'—',r.sent_at?new Date(r.sent_at).toLocaleString('en-GB',{timeZone:'Asia/Baghdad'}):'—',r.is_read?'خوێندی':'نەخوێندی','تۆمارکری'];
cells.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;if(i===2&&r.detail){const sub=document.createElement('small');sub.textContent=r.detail;td.append(sub)}tr.append(td)});body.append(tr)}
if(!filtered.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='هیچ تۆمارەک نەهاتە دیتن';tr.append(td);body.append(tr)}}
async function load(){const button=$('reload');button.disabled=true;$('status').textContent='چاوەڕێ بکە...';
try{const {data,error}=await window.ziataSB.rpc('ziata_admin_notification_log',{p_kind:$('kind').value,p_limit:1000});if(error)throw error;records=data||[];render()}
catch(e){$('status').textContent='خەلەتی: '+(e.message||e);$('rows').replaceChildren()}finally{button.disabled=false}}
async function start(){if(started)return;started=true;try{const c=await window.ziataContext();if(!c.session||c.profile?.status!=='approved'||c.profile?.is_admin!==true){$('status').textContent='بتنێ ئەدمین دشێت ڤێ پەیجێ ببینیت';return}
$('kind').onchange=load;$('search').oninput=render;$('reload').onclick=load;await load()}catch(e){$('status').textContent=e.message||String(e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start()})();