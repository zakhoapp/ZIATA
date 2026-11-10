// Check the actual announcement API permission, not a possibly stale client-side role.
(async function(){
 const link=document.getElementById('zi-secretary-notification-shortcut');
 if(!link)return;
 try{
  const ctx=await window.ziataContext();
  if(!ctx?.session||ctx.profile?.status!=='approved')return;
  let allowed=ctx.profile.is_admin===true;
  if(!allowed){
   const response=await fetch(window.ZIATA_SUPABASE.url+'/functions/v1/ziata-announcements',{
    method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+ctx.session.access_token,'apikey':window.ZIATA_SUPABASE.key},
    body:JSON.stringify({action:'users'})
   });
   allowed=response.ok;
   if(!allowed)console.warn('Notification sender permission denied:',response.status);
  }
  if(allowed){
   link.hidden=false;
   link.removeAttribute('hidden');
   link.style.setProperty('display','flex','important');
  }
 }catch(e){console.warn('Notification shortcut unavailable',e)}
})();
