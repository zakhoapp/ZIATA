(()=>{'use strict';
const $=id=>document.getElementById(id);
let started=false;
async function init(){
 if(started||!window.ziataSB||!window.ziataContext)return;
 started=true;
 const box=$('zi-v79-my-work'),msg=$('zi-v79-status');
 if(!box)return;
 try{
  const ctx=await window.ziataContext();
  if(!ctx?.session?.user||ctx?.profile?.status!=='approved')return;
  box.hidden=false;
  msg.textContent='زانیاریێن تە دهێنە حسابکرن…';
  const {data,error}=await window.ziataSB.rpc('ziata_my_work_summary');
  if(error)throw error;
  const committees=Number(data?.committee_count),projects=Number(data?.project_count),records=Number(data?.matched_records);
  if(!Number.isFinite(committees)||!Number.isFinite(projects)||!Number.isFinite(records))throw Error('Server data unavailable');
  $('zi-v79-committees').textContent=String(committees);
  $('zi-v79-projects').textContent=String(projects);
  if(records===0){
   msg.textContent='هیچ تۆمارەک ب ناڤێ پروفایلێ تە نەهاتە دیتن. ئەگەر ناڤ جودا بیت، ئەدمین پێدڤییە وێ راست بکەت.';
  }else{
   msg.textContent='ژ '+records+' تۆمارێن گرێدای ناڤێ تە ل Supabase هاتنە حسابکرن.';
  }
 }catch(e){
  box.hidden=false;
  $('zi-v79-committees').textContent='—';
  $('zi-v79-projects').textContent='—';
  msg.textContent='ژمارە هێشتا بەردەست نینن. SQL ـا V79 پێدڤییە ل Supabase جێبەجێ ببیت.';
  console.warn('ZIATA personal work summary unavailable',e);
 }
}
window.addEventListener('ziata-ready',init,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();