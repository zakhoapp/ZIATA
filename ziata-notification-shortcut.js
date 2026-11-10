// Show announcement shortcut only to approved admins or authorized senders.
window.addEventListener('ziata-ready', async ({detail:ctx}) => {
  if (!ctx?.session || ctx.profile?.status !== 'approved') return;
  let allowed = ctx.profile.is_admin === true;
  if (!allowed) {
    const {data,error} = await window.ziataSB.from('ziata_notification_senders')
      .select('user_id').eq('user_id',ctx.session.user.id).maybeSingle();
    if (error) { console.warn('Notification shortcut permission lookup failed',error); return; }
    allowed = !!data;
  }
  if (!allowed) return;
  const link=document.getElementById('zi-secretary-notification-shortcut');
  if (link) link.hidden=false;
});
