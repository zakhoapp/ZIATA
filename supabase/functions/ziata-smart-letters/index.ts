import { createClient } from 'npm:@supabase/supabase-js@2';
const origins=new Set(['https://zakhoapp.github.io','https://ziata.netlify.app']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://zakhoapp.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Vary':'Origin'};
 const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(!origins.has(origin))return out({error:'Origin forbidden'},403);
 if(req.method!=='POST')return out({error:'POST only'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const auth=createClient(url,anon,{auth:{persistSession:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user)return out({error:'Login required'},401);
  const db=createClient(url,service,{auth:{persistSession:false}});
  const {data:profile,error:profileError}=await db.from('profiles').select('is_admin,status').eq('id',user.id).single();
  if(profileError||profile?.is_admin!==true||profile.status!=='approved')return out({error:'Admin required'},403);
  const input=await req.json();
  if(input.action==='list'){
   const {data,error}=await db.from('ziata_smart_letters').select('id,drive_name,drive_url,letter_type,letter_number,letter_date,subject,ai_status,approval_status,created_at').eq('approval_status','pending').order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   const ids=(data||[]).map(x=>x.id);
   const {data:recipients,error:re}=ids.length?await db.from('ziata_letter_recipients').select('letter_id,user_id,extracted_name,match_confidence,approved').in('letter_id',ids):{data:[],error:null};
   if(re)throw re;
   return out({letters:data,recipients});
  }
  if(input.action==='review'){
   const letterId=String(input.letter_id||'');
   if(!/^[a-f0-9-]{36}$/i.test(letterId))return out({error:'Invalid letter id'},400);
   if(input.decision!=='approve'&&input.decision!=='reject')return out({error:'Invalid decision'},400);
   // Do not send any notifications from this endpoint. Approval is a separate audited step.
   const {data:letter,error:le}=await db.from('ziata_smart_letters').select('id,approval_status,ai_status').eq('id',letterId).single();
   if(le||!letter)return out({error:'Letter not found'},404);
   if(letter.approval_status!=='pending')return out({error:'Already reviewed'},409);
   if(input.decision==='approve'&&letter.ai_status!=='ready')return out({error:'AI extraction must be ready and reviewed'},409);
   const selected=Array.isArray(input.user_ids)?[...new Set(input.user_ids.filter((v:unknown)=>typeof v==='string'))]:[];
   if(input.decision==='approve'&&selected.length===0)return out({error:'Select at least one recipient'},400);
   const {data:rows,error:rr}=await db.from('ziata_letter_recipients').select('user_id').eq('letter_id',letterId);
   if(rr)throw rr;
   const allowed=new Set((rows||[]).map(x=>x.user_id));
   if(selected.some(x=>!allowed.has(x)))return out({error:'Recipient not matched to letter'},400);
   const {data:updated,error:ue}=await db.from('ziata_smart_letters').update({approval_status:input.decision==='approve'?'approved':'rejected',reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',letterId).eq('approval_status','pending').select('id').maybeSingle();
   if(ue)throw ue;
   if(!updated)return out({error:'Already reviewed'},409);
   if(selected.length){
    const {error:upErr}=await db.from('ziata_letter_recipients').update({approved:true}).eq('letter_id',letterId).in('user_id',selected);
    if(upErr)throw upErr;
   }
   await db.from('ziata_letter_events').insert({letter_id:letterId,actor_id:user.id,action:input.decision,details:{recipient_count:selected.length,notification_sent:false}});
   return out({ok:true,notification_sent:false,note:'Approved for review queue; sending is not yet enabled.'});
  }
  return out({error:'Invalid action'},400);
 }catch(e){console.error(e);return out({error:'Server error'},500)}
});
