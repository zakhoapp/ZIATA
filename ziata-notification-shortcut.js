// Reliable permission-aware shortcut, even when ziata-ready fired before this script loaded.
(async function(){
  const link=document.getElementById('zi-secretary-notification-shortcut');
  if(!link)return;
  try{
    for(let i=0;i<30 && !window.ziataContext;i++) await new Promise(r=>setTimeout(r,100));
    if(!window.ziataContext)return;
    const ctx=await window.ziataContext();
    if(!ctx?.session || ctx.profile?.status!=='approved')return;
    let allowed=ctx.profile.is_admin===true;
    if(!allowed){
      const {data,error}=await window.ziataSB.from('ziata_notification_senders')
        .select('user_id').eq('user_id',ctx.session.user.id).maybeSingle();
      if(error){console.warn('Notification shortcut permission lookup failed',error);return}
      allowed=!!data;
    }
    if(allowed){link.hidden=false;link.style.removeProperty('display');}
  }catch(e){console.warn('Notification shortcut unavailable',e)}
})();
