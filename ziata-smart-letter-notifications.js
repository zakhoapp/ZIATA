(()=>{'use strict';let started=false;const $=id=>document.getElementById(id);
const node=(tag,content,cls)=>{const n=document.createElement(tag);if(content!=null)n.textContent=content;if(cls)n.className=cls;return n};
async function start(){if(started)return;started=true;try{
const ctx=await window.ziataContext(),uid=ctx.session?.user?.id;
if(!uid){$('status').textContent='پێدڤیە داخڵی حسابێ خۆ ببی';return}
const sb=window.ziataSB;
async function refresh(){
const {data:notes,error}=await sb.from('ziata_smart_letter_notifications').select('id,letter_id,is_read,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(100);
if(error)throw error;
const list=$('letters');list.replaceChildren();
const ids=[...new Set((notes||[]).map(n=>n.letter_id))];
let letters=[];
if(ids.length){const r=await sb.from('ziata_smart_letters').select('id,drive_name,drive_url,subject,letter_number,letter_date').in('id',ids);if(r.error)throw r.error;letters=r.data||[]}
const lookup=new Map(letters.map(l=>[l.id,l]));
$('status').textContent=(notes||[]).filter(n=>!n.is_read).length+' ئاگەهداریێن نەخوێندی';
if(!notes?.length){list.append(node('p','هێشتا هیچ نڤیسارەک بۆ تە نەهاتیە پەسەندکرن.','status'));return}
for(const n of notes){
const l=lookup.get(n.letter_id),card=node('article',null,'card'+(n.is_read?'':' unread'));
card.append(node('h3',l?.subject||l?.drive_name||'نڤیسارا پەسەندکری'));
card.append(node('p',[l?.letter_number,l?.letter_date,l?.drive_name].filter(Boolean).join(' · '),'meta'));
card.append(node('p','بەروارا ئاگەهداریێ: '+new Date(n.created_at).toLocaleString(),'meta'));
const actions=node('div',null,'actions');
if(l?.drive_url){const a=node('a','ڤەکرنا نڤیسارا ئەسلی','btn primary');a.href=l.drive_url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a)}
if(!n.is_read){const b=node('button','وەک خوێندی نیشان بدە','btn');b.type='button';b.onclick=async()=>{b.disabled=true;const r=await sb.from('ziata_smart_letter_notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('id',n.id).eq('user_id',uid);if(r.error){alert(r.error.message);b.disabled=false}else await refresh()};actions.append(b)}
card.append(actions);list.append(card)
}}
await refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(console.error)});
}catch(e){$('status').textContent='خەلەتی: '+(e.message||e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();