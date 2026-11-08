(() => {
'use strict';
const $ = id => document.getElementById(id);
const TABLE = 'ziata_committee_records';
let sb, admin = false, page = 0, all = [], filtered = [], initStarted = false, employeeProfiles=[];
const PAGE_SIZE = 40;
function message(s, error=false) {const el=$('zi-v68-message');el.textContent=s;el.classList.toggle('zi-v68-error',error);}
function csvParse(input) {
  // RFC 4180 compatible: quotes, commas, embedded newlines and CRLF.
  const result=[];let row=[],field='',quoted=false;
  input=String(input).replace(/^\uFEFF/,'');
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){
      if(quoted&&input[i+1]==='"'){field+='"';i++}else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(field);field=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&input[i+1]==='\n')i++;
      row.push(field);result.push(row);row=[];field='';
    }else field+=ch;
  }
  if(quoted)throw Error('CSV ـێ هەڵەیا کوتیشن هەیە.');
  if(field!==''||row.length){row.push(field);result.push(row)}
  return result;
}
function splitTypes(value){
 return [...new Set(String(value||'').split(/\r?\n|؛|;/).map(x=>x.trim()).filter(Boolean))];
}
function distinctTypes(){
 const types=[...new Set(all.flatMap(x=>splitTypes(x.committee_type)))].sort((a,b)=>a.localeCompare(b));
 const current=$('zi-v68-filter').value;
 $('zi-v68-filter').replaceChildren(new Option('هەمی لێژنە',''),...types.map(x=>new Option(x,x)));
 if(types.includes(current))$('zi-v68-filter').value=current;
 const choices=$('zi-v68-choices');choices.replaceChildren();
 for(const type of types){
  const b=document.createElement('button');b.type='button';b.className='zi-v68-choice';b.textContent='+ '+type;
  b.setAttribute('aria-pressed',String(splitTypes($('zi-v68-type').value).includes(type)));
  b.onclick=()=>{
   const set=new Set(splitTypes($('zi-v68-type').value));
   if(set.has(type))set.delete(type);else set.add(type);
   $('zi-v68-type').value=[...set].join('\n');
   updateChoices();
  };
  choices.appendChild(b);
 }
 updateChoices();
}
function updateChoices(){
 const set=new Set(splitTypes($('zi-v68-type').value));
 for(const b of $('zi-v68-choices').querySelectorAll('button')){
   const type=b.textContent.slice(2);
   const selected=set.has(type);
   b.classList.toggle('selected',selected);
   b.setAttribute('aria-pressed',String(selected));
   b.textContent=(selected?'✓ ':'+ ')+type;
 }
}
function groupRows(rows){
 const groups=new Map();
 for(const row of rows){
  const key=row.employee_id ? 'id:'+row.employee_id : 'name:'+row.staff_name.trim().replace(/\s+/g,' ').toLocaleLowerCase();
  if(!groups.has(key))groups.set(key,{staff_name:row.staff_name,entries:[],committees:new Set(),projects:new Set(),employee_id:row.employee_id||null});
  const group=groups.get(key);group.entries.push(row);
  for(const type of splitTypes(row.committee_type))group.committees.add(type);
  if(row.projects_text?.trim())group.projects.add(row.projects_text.trim());
 }
 return [...groups.values()];
}
function view(){
 const query=$('zi-v68-search').value.trim().toLowerCase(),type=$('zi-v68-filter').value;
 filtered=groupRows(all).filter(x=>(!type||x.committees.has(type))&&(!query||[x.staff_name,...x.committees,...x.projects].some(v=>String(v||'').toLowerCase().includes(query))));
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
 const rows=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const frag=document.createDocumentFragment();
 for(const group of rows){
  const tr=document.createElement('tr');
  const name=document.createElement('td');const profileLink=document.createElement('a');profileLink.href='engineer-profiles.html?name='+encodeURIComponent(group.staff_name);profileLink.className='zi-v78-profile-link';profileLink.textContent=group.staff_name;profileLink.title='دیتنا پروفایلێ پیشەیی';name.appendChild(profileLink);tr.appendChild(name);
  const types=document.createElement('td');
  if(!group.committees.size)types.textContent='—';
  for(const type of group.committees){
   const badge=document.createElement('span');badge.className='zi-v69-committee-tag';badge.textContent=type;types.appendChild(badge);
  }
  tr.appendChild(types);
  const projects=document.createElement('td');projects.textContent=[...group.projects].join('\n')||'—';tr.appendChild(projects);
  if(admin){
   const td=document.createElement('td');const edit=document.createElement('button');edit.type='button';edit.textContent='دەستکاریکرنا لێژنان';edit.onclick=()=>editGroup(group);
   td.append(edit);const linked=document.createElement('small');linked.className='zi-v80-linked';linked.textContent=group.employee_id?'✓ حساب گرێدایە':'⚠ ب حسابی نەگرێدایە';td.appendChild(linked);tr.appendChild(td);
  }
  frag.appendChild(tr);
 }
 $('zi-v68-rows').replaceChildren(frag);
 $('zi-v68-count').textContent=filtered.length+' فەرمانبەر · '+all.length+' تۆمار';
 $('zi-v68-page').textContent=(filtered.length? page+1:0)+' / '+Math.ceil(filtered.length/PAGE_SIZE);
 $('zi-v68-prev').disabled=page===0;$('zi-v68-next').disabled=(page+1)*PAGE_SIZE>=filtered.length;
}
function editGroup(group){
 // Edit a single membership record. Existing separate records are preserved.
 if(group.entries.length===1){editItem(group.entries[0]);return;}
 const list=group.entries.map((e,i)=>(i+1)+'. '+(splitTypes(e.committee_type).join(' / ')||'بێ ناڤێ لێژنێ')).join('\n');
 const answer=prompt('ئەڤ فەرمانبەرە د '+group.entries.length+' تۆماران دا یە. ژمارا تۆمارێ هەلبژێرە دا وێ دەستکاری بکەی:\n'+list,'1');
 if(answer===null)return;
 const n=Number(answer);
 if(!Number.isInteger(n)||n<1||n>group.entries.length){message('ژمارە نەدروستە',true);return;}
 editItem(group.entries[n-1]);
}
async function loadAll(){
 message('زانیاری دهێنە بارکرن…');
 const rows=[];
 // PostgREST caps rows per request; paginate by ID and do not silently truncate.
 let from=0;
 while(true){
  const {data,error}=await sb.from(TABLE).select('id,staff_name,committee_type,projects_text,notes,legacy_sheet_row,employee_id,created_at').order('id').range(from,from+499);
  if(error)throw error;
  rows.push(...(data||[]));if(!data||data.length<500)break;
  from+=500;if(from>100000)throw Error('ژمارا تۆماران زۆرە؛ پێدڤی ب فلتەرا سێرڤەری یە');
 }
 all=rows;distinctTypes();view();
 message(all.length+' تۆمار ژ Supabase هاتنە بارکرن.');
}
function clearForm(){$('zi-v68-form').reset();$('zi-v80-employee').value='';$('zi-v68-id').value='';$('zi-v68-save').textContent='پاراستنا تۆمارێ';updateChoices();}
function editItem(item){$('zi-v68-id').value=item.id;$('zi-v80-employee').value=item.employee_id||'';$('zi-v68-name').value=item.staff_name||'';$('zi-v68-type').value=splitTypes(item.committee_type).join('\n');updateChoices();$('zi-v68-projects').value=item.projects_text||'';$('zi-v68-notes').value=item.notes||'';$('zi-v68-form').scrollIntoView({behavior:'smooth',block:'start'});}
async function deleteItem(item){
 if(!admin||!confirm('دڵنیایی ژ ژێبرنا تۆمارێ '+item.staff_name+'؟'))return;
 const {error}=await sb.from(TABLE).delete().eq('id',item.id);
 if(error)message('نەشیا ژێببەت: '+error.message,true);else await loadAll();
}
async function save(e){
 e.preventDefault();if(!admin)return;
 if($('zi-v80-employee').disabled){message('ناشێت تۆمار بهێتە گۆڕین هەتا لیستا ناسنامەیێن حسابان بار نەبیت.',true);return;}
 const button=$('zi-v68-save');button.disabled=true;
 const payload={staff_name:$('zi-v68-name').value.trim(),committee_type:splitTypes($('zi-v68-type').value).join('\n'),projects_text:$('zi-v68-projects').value.trim(),notes:$('zi-v68-notes').value.trim(),employee_id:$('zi-v80-employee').value||null};
 try{
  if(!payload.committee_type||payload.committee_type.length>250)throw Error('ناڤێ لێژنان پێدڤییە و کۆی درێژاهیا وان نابیت ژ 250 پیتان پتر بیت.');
  const id=$('zi-v68-id').value;
  const {error}=id?await sb.from(TABLE).update(payload).eq('id',id):await sb.from(TABLE).insert(payload);
  if(error)throw error;clearForm();await loadAll();
 }catch(e){message('نەشیا تۆمار بکەت: '+e.message,true)}finally{button.disabled=false}
}
async function importCsv(){
 if(!admin||$('zi-v80-employee').disabled)return;
 const file=$('zi-v68-file').files?.[0];if(!file){$('zi-v68-import-status').textContent='CSV هەلبژێرە';return}
 if(!confirm('دا داتایێن CSV بۆ Supabase هێنە Import کرن؟ رێزێن هەمان ژمارە دێ نوو بن.'))return;
 const button=$('zi-v68-import'),status=$('zi-v68-import-status');button.disabled=true;
 try{
  const records=csvParse(await file.text());
  if(!records.length)throw Error('فایل ڤالایە');
  // Data tab headers are historically misleading: A=staff, B=committee type, C=projects.
  const first=records[0].map(v=>String(v||'').trim());
  if(first[0]!=='ناوی پڕۆژە'||first[1]!=='جۆری لێژنە'||first[2]!=='ناوی ئەندازیاران'){
   throw Error('ئەڤ CSV ـە نە ژ تابێ Data یێ شیتا لێژنە و پروژە یە. ستونێن A/B/C هەمان نینن.');
  }
  const items=records.slice(1).map((r,i)=>({
    legacy_sheet_row:i+2,staff_name:String(r[0]||'').trim(),
    committee_type:String(r[1]||'').trim(),projects_text:String(r[2]||'').trim()
  })).filter(x=>x.staff_name);
  const unique=new Map(items.map(x=>[x.legacy_sheet_row,x]));
  let done=0;
  for(let i=0;i<items.length;i+=75){
   const batch=items.slice(i,i+75).map(item=>({ ...item,employee_id:all.find(old=>old.legacy_sheet_row===item.legacy_sheet_row)?.employee_id||null }));
   const {error}=await sb.from(TABLE).upsert(batch,{onConflict:'legacy_sheet_row'});
   if(error)throw error;done+=batch.length;status.textContent=done+' / '+items.length+' تۆمار Import بوون';
  }
  status.textContent='سەرکەفتی: '+done+' تۆمار هاتنە ڤەگوهاستن. '+(records.length-1-items.length)+' رێزێن ڤالا هاتنە هێلان.';
  await loadAll();
 }catch(e){status.textContent='خەلەتی: '+e.message}finally{button.disabled=false}
}
async function loadEmployeeProfiles(){
 const {data,error}=await sb.from('profiles').select('id,full_name,department,status').eq('status','approved').order('full_name').limit(1000);
 if(error)throw error;
 employeeProfiles=data||[];
 const picker=$('zi-v80-employee');picker.replaceChildren(new Option('هێشتا ب حسابەکی نەهاتیە گرێدان',''));
 for(const user of employeeProfiles){
  picker.appendChild(new Option((user.full_name||'بێ ناڤ')+' · '+(user.department||'بێ بەش')+' · '+user.id.slice(0,8),user.id));
 }
}
async function init(){
 if(initStarted||!window.ziataContext||!window.ziataSB)return;initStarted=true;
 let ctx;try{ctx=await window.ziataContext()}catch(e){message(e.message,true);return}
 if(!ctx.session?.user||!ctx.allowed?.includes('committees')){message('دەستهەلاتا دیتنا لێژنان نینە.',true);return}
 admin=!!ctx.profile?.is_admin;sb=window.ziataSB;
 if(admin){$('zi-v68-admin').hidden=false;$('zi-v68-action-title').hidden=false;try{await loadEmployeeProfiles()}catch(e){message('نەشیا حسابێن فەرمانبەران بار بکەت: '+e.message,true);$('zi-v80-employee').disabled=true}}
 $('zi-v68-search').addEventListener('input',()=>{page=0;view()});
 $('zi-v68-filter').addEventListener('change',()=>{page=0;view()});
 $('zi-v68-prev').onclick=()=>{page--;view()};$('zi-v68-next').onclick=()=>{page++;view()};
 $('zi-v68-type').addEventListener('input',updateChoices);$('zi-v68-form').addEventListener('submit',save);$('zi-v68-cancel').onclick=clearForm;$('zi-v68-import').onclick=importCsv;
 try{await loadAll()}catch(e){message('Supabase ـێ نەشیا لیستێ بار بکەت. SQL ـا V68 پێدڤییە ل Supabase بهێتە Run کرن. '+e.message,true);}
}
window.addEventListener('ziata-ready',init,{once:true});
if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
