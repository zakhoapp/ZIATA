(()=>{'use strict';
const $=id=>document.getElementById(id),TABLE='ziata_committee_records';
let started=false,engineers=[],selected='',allowed=false;
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const keyName=s=>clean(s).toLocaleLowerCase();
const types=s=>[...new Set(String(s||'').split(/\r?\n|؛|;/).map(clean).filter(Boolean))];
const projects=s=>[...new Set(String(s||'').split(/\r?\n/).map(clean).filter(Boolean))];
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
function updateStatus(s,error=false){$('zi-v78-status').textContent=s;$('zi-v78-status').classList.toggle('error',error);}
async function fetchRows(sb){
 const collected=[];
 for(let from=0;from<100000;from+=500){
  const {data,error}=await sb.from(TABLE).select('id,staff_name,committee_type,projects_text,notes').order('id').range(from,from+499);
  if(error)throw error;
  collected.push(...(data||[]));
  if(!data||data.length<500)return collected;
 }
 throw Error('ژمارا تۆماران زۆرە. پێدڤی ب پەیجکرنا سێرڤەری یە.');
}
function build(rows){
 const byName=new Map();
 for(const item of rows){
  const name=clean(item.staff_name);
  if(!name)continue;
  const key=keyName(name);
  if(!byName.has(key))byName.set(key,{key,name,committees:new Set(),projects:new Set(),records:0});
  const profile=byName.get(key);profile.records++;
  for(const value of types(item.committee_type))profile.committees.add(value);
  for(const value of projects(item.projects_text))profile.projects.add(value);
 }
 engineers=[...byName.values()].sort((a,b)=>a.name.localeCompare(b.name));
 $('zi-v78-engineers').textContent=engineers.length;
 const allTypes=[...new Set(engineers.flatMap(x=>[...x.committees]))].sort((a,b)=>a.localeCompare(b));
 const allProjects=new Set(engineers.flatMap(x=>[...x.projects]));
 $('zi-v78-committees').textContent=allTypes.length;
 $('zi-v78-projects').textContent=allProjects.size;
 $('zi-v78-type').replaceChildren(new Option('هەمی لێژنە',''),...allTypes.map(x=>new Option(x,x)));
 render();
}
function profileCard(profile){
 const card=el('article','zi-v78-card');
 const initials=clean(profile.name).split(' ').slice(0,2).map(x=>x[0]||'').join('');
 const header=el('div','zi-v78-card-head');header.append(el('div','zi-v78-avatar',initials),el('h2','',profile.name));
 const info=el('div','zi-v78-numbers');
 for(const [num,title] of [[profile.committees.size,'لێژنە'],[profile.projects.size,'پرۆژە']]){
  const b=el('span');b.append(el('strong','',num),el('small','',title));info.append(b);
 }
 const tags=el('div','zi-v78-tags');
 for(const name of [...profile.committees].slice(0,3))tags.append(el('span','zi-v78-tag',name));
 if(profile.committees.size>3)tags.append(el('span','zi-v78-tag','+'+(profile.committees.size-3)));
 const button=el('button','zi-v78-open','دیتنا پروفایلێ');button.type='button';
 button.addEventListener('click',()=>{selected=profile.key;history.replaceState(null,'',location.pathname+'?name='+encodeURIComponent(profile.name));render();window.scrollTo({top:0,behavior:'smooth'});});
 card.append(header,info,tags,button);return card;
}
function renderDetail(profile){
 const container=$('zi-v78-detail');container.replaceChildren();container.hidden=false;
 $('zi-v78-directory').hidden=true;
 const back=el('button','zi-v78-back','↩ ڤەگەڕیان بۆ لیستێ');back.type='button';back.onclick=()=>{selected='';history.replaceState(null,'',location.pathname);render()};
 const title=el('div','zi-v78-person');
 const initials=clean(profile.name).split(' ').slice(0,2).map(x=>x[0]||'').join('');
 title.append(el('div','zi-v78-avatar zi-v78-avatar-large',initials),el('h2','',profile.name));
 const stats=el('div','zi-v78-profile-stats');
 for(const [num,name] of [[profile.committees.size,'ژمارا لێژنان'],[profile.projects.size,'ژمارا پرۆژان'],['—','ئەرکێن تەمامکری'],['—','ئەرکێن ماین']]){
  const box=el('div');box.append(el('strong','',num),el('span','',name));stats.append(box);
 }
 container.append(back,title,stats);
 for(const [heading,values,empty] of [['لێژنەیێن ئەندازیاری',[...profile.committees],'هیچ لێژنەیەک نەهاتیە تۆمارکرن'],['پرۆژەیێن گرێدای',[...profile.projects],'هیچ پرۆژەیەک نەهاتیە تۆمارکرن']]){
  const block=el('section','zi-v78-list');block.append(el('h3','',heading));
  if(!values.length)block.append(el('p','',empty));
  else{const ul=el('ul');for(const value of values)ul.append(el('li','',value));block.append(ul);}
  container.append(block);
 }
}
function render(){
 const found=engineers.find(x=>x.key===selected);
 if(found){renderDetail(found);$('zi-v78-visible').textContent='';return;}
 selected='';$('zi-v78-detail').hidden=true;$('zi-v78-directory').hidden=false;
 const query=keyName($('zi-v78-search').value),type=$('zi-v78-type').value;
 const matching=engineers.filter(x=>(!type||x.committees.has(type))&&(!query||[x.name,...x.committees,...x.projects].some(v=>keyName(v).includes(query))));
 $('zi-v78-visible').textContent=matching.length+' کەس';
 const directory=$('zi-v78-directory');directory.replaceChildren();
 for(const profile of matching)directory.append(profileCard(profile));
 if(!matching.length)directory.append(el('p','zi-v78-empty','هیچ ئەنجامەک نەهاتە دیتن.'));
}
async function init(){
 if(started||!window.ziataSB||!window.ziataContext)return;started=true;
 let ctx;
 try{ctx=await window.ziataContext()}catch(e){updateStatus('نەشیا گرێدانێ پێک بینیت: '+e.message,true);return;}
 allowed=!!(ctx.profile?.status==='approved'&&(ctx.profile?.is_admin||ctx.allowed?.includes('committees')));
 if(!allowed){updateStatus('دەستهەلاتا دیتنا پروفایلێن ئەندازیاران نینە. رێپێدانا لێژنان پێدڤییە.',true);return;}
 $('zi-v78-panel').hidden=false;
 $('zi-v78-search').addEventListener('input',render);$('zi-v78-type').addEventListener('change',render);
 try{const rows=await fetchRows(window.ziataSB);build(rows);
  const requested=keyName(new URLSearchParams(location.search).get('name')||'');
  if(requested&&engineers.some(x=>x.key===requested)){selected=requested;render();}
  updateStatus('زانیاریێن پیشەیی ژ Supabase هاتنە بارکرن.');
 }catch(e){updateStatus('نەشیا زانیاریێن لێژنان بار بکەت: '+e.message,true);}
}
window.addEventListener('ziata-ready',init,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();