(()=>{'use strict';
const $=id=>document.getElementById(id),TABLE='ziata_audit_events',PAGE_SIZE=50;
let sb=null,started=false,page=0,total=0,sequence=0;
const names={committees:'لێژنە و پرۆژە',accounts:'حسابێن فەرمانبەران',permissions:'دەستهەلات',permits:'مۆڵەت',announcements:'ئاگەهداری',projects:'پرۆژە',letters:'نڤیسار',transactions:'مامەلە',engineers:'ئەندازیار'};
const ops={INSERT:'زێدەکرن',UPDATE:'دەستکاریکرن',DELETE:'ژێبرن'};
const status=(msg,error=false)=>{$('zi-v77-status').textContent=msg;$('zi-v77-status').classList.toggle('error',error)};
function format(value){
 if(value===null||value===undefined)return '—';
 if(typeof value==='object')return JSON.stringify(value,null,2);
 return String(value);
}
function diffDetails(record){
 const before=record.before_data||{},after=record.after_data||{},fields=record.changed_fields||[];
 const box=document.createElement('div');box.className='zi-v77-diff';
 for(const key of fields){
  const item=document.createElement('section');item.className='zi-v77-change';
  const label=document.createElement('strong');label.textContent=key;
  const oldEl=document.createElement('pre'),newEl=document.createElement('pre');
  oldEl.textContent='بەری: '+format(before[key]);
  newEl.textContent='پشتی: '+format(after[key]);
  item.append(label,oldEl,newEl);box.appendChild(item);
 }
 if(!fields.length)box.textContent='وردەکاری نینە';
 return box;
}
function render(rows){
 const parent=$('zi-v77-rows');parent.replaceChildren();
 for(const record of rows){
  const tr=document.createElement('tr');
  const values=[new Date(record.happened_at).toLocaleString('en-GB',{timeZone:'Asia/Baghdad'}),names[record.system_name]||record.system_name,ops[record.operation]||record.operation,record.actor_email||record.actor_id||'سێرڤەر / سیستەم',record.record_id||'—'];
  for(const value of values){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}
  const details=document.createElement('td');const d=document.createElement('details');const summary=document.createElement('summary');summary.textContent='دیتنا گۆڕینان';d.append(summary,diffDetails(record));details.appendChild(d);tr.appendChild(details);parent.appendChild(tr);
 }
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='هیچ کردارەک نەهاتە دیتن.';tr.appendChild(td);parent.appendChild(tr);}
 $('zi-v77-total').textContent=total+' تۆمار';
 $('zi-v77-page').textContent=(total?page+1:0)+' / '+Math.ceil(total/PAGE_SIZE);
 $('zi-v77-prev').disabled=page===0;$('zi-v77-next').disabled=(page+1)*PAGE_SIZE>=total;
}
async function load(){
 if(!sb)return;const current=++sequence;
 const type=$('zi-v77-system').value,op=$('zi-v77-op').value,query=$('zi-v77-search').value.trim();
 status('تۆمار دهێنە بارکرن…');
 let request=sb.from(TABLE).select('id,happened_at,actor_id,actor_email,system_name,entity_name,record_id,operation,before_data,after_data,changed_fields',{count:'exact'}).order('happened_at',{ascending:false}).order('id',{ascending:false});
 if(type)request=request.eq('system_name',type);
 if(op)request=request.eq('operation',op);
 if(query){
  const safe=query.replace(/[,%()]/g,' ').trim();
  if(safe)request=request.or('actor_email.ilike.%'+safe+'%,record_id.ilike.%'+safe+'%,actor_id.eq.'+( /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(safe)?safe:'00000000-0000-0000-0000-000000000000'));
 }
 const {data,error,count}=await request.range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);
 if(current!==sequence)return;
 if(error){status('نەشیا Audit Log بار بکەت: '+error.message+' — SQL ـا V77 ل Supabase جێبەجێ بکە.',true);return;}
 total=count||0;render(data||[]);
 status('مێژوویا گۆڕینان ژ Supabase هاتە بارکرن. کات ب کاتژمێرا عێراقێ یە.');
}
async function init(){
 if(started||!window.ziataSB||!window.ziataContext)return;started=true;
 let c;try{c=await window.ziataContext()}catch(e){status(e.message,true);return;}
 if(!c?.session||c.profile?.status!=='approved'||!c.profile?.is_admin){status('ئەڤ لاپەرە بتنێ بۆ ئەدمینە.',true);$('zi-v77-private').hidden=true;return;}
 sb=window.ziataSB;$('zi-v77-private').hidden=false;
 const options=Object.entries(names).map(([k,v])=>new Option(v,k));
 $('zi-v77-system').append(...options);
 $('zi-v77-system').onchange=()=>{page=0;load()};
 $('zi-v77-op').onchange=()=>{page=0;load()};
 let searchToken=0;
 $('zi-v77-search').oninput=()=>{const token=++searchToken;const value=$('zi-v77-search').value;Promise.resolve().then(()=>{if(token===searchToken&&value===$('zi-v77-search').value){page=0;load()}})};
 $('zi-v77-refresh').onclick=()=>load();
 $('zi-v77-prev').onclick=()=>{if(page>0){page--;load()}};
 $('zi-v77-next').onclick=()=>{if((page+1)*PAGE_SIZE<total){page++;load()}};
 load();
}
window.addEventListener('ziata-ready',init,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();