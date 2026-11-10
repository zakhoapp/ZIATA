import { createClient } from 'npm:@supabase/supabase-js@2';
const MAX_BYTES=12*1024*1024;
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[أإآٱ]/g,'ا').replace(/[ىي]/g,'ي').replace(/[ك]/g,'ک').replace(/[ة]/g,'ه').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const answer=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return answer({error:'POST only'},405);
 // Server-to-server ingestion only. Never expose this token to browser or GitHub.
 const expected=Deno.env.get('ZIATA_INGEST_SECRET');
 const received=req.headers.get('x-ziata-ingest-secret');
 if(!expected||!received||received.length!==expected.length){return answer({error:'Forbidden'},403);}
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^received.charCodeAt(i);
 if(diff!==0)return answer({error:'Forbidden'},403);
 try{
  const input=await req.json();
  const id=String(input.file_id||''),name=String(input.name||'').slice(0,250),mime=String(input.mime||''),base64=String(input.base64||'');
  if(!/^[a-zA-Z0-9_-]{10,150}$/.test(id)||!name||!['application/pdf','image/jpeg','image/png'].includes(mime))return answer({error:'Invalid file metadata'},400);
  if(!base64||base64.length>Math.ceil(MAX_BYTES*4/3)+100)return answer({error:'File too large'},413);
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,apiKey=Deno.env.get('OPENAI_API_KEY');
  if(!apiKey)return answer({error:'AI key not configured'},503);
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data:existing,error:checkError}=await db.from('ziata_smart_letters').select('id').eq('drive_file_id',id).maybeSingle();
  if(checkError)throw checkError;
  if(existing)return answer({ok:true,duplicate:true,letter_id:existing.id});
  const {data:letter,error:insertError}=await db.from('ziata_smart_letters').insert({
   drive_file_id:id,drive_name:name,drive_mime:mime,drive_url:'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view',
   ai_status:'processing',approval_status:'pending'
  }).select('id').single();
  if(insertError||!letter)throw insertError||Error('Insert failed');
  try{
   const attachment=mime==='application/pdf'
    ?{type:'input_file',filename:name,file_data:'data:application/pdf;base64,'+base64}
    :{type:'input_image',image_url:'data:'+mime+';base64,'+base64,detail:'high'};
   const prompt='Read this official administrative letter in Kurdish Badini/Sorani or Arabic. Extract ONLY visible facts. Return valid JSON with keys letter_type,letter_number,letter_date,subject,employee_names,summary. employee_names must be an array of full names of employees who are clearly SUBJECTS or ADDRESSEES of this letter (not signatories, directors, organizations or incidental mentions). Do not invent names. If uncertain, omit. All other fields strings. No markdown.';
   const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({
    model:Deno.env.get('ZIATA_AI_MODEL')||'gpt-4.1-mini',
    input:[{role:'user',content:[{type:'input_text',text:prompt},attachment]}],
    text:{format:{type:'json_object'}},max_output_tokens:1300,store:false
   })});
   const payload=await res.json();
   if(!res.ok)throw Error('AI API '+res.status+': '+JSON.stringify(payload).slice(0,300));
   const raw=(payload.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('');
   if(!raw)throw Error('AI returned no text');
   const extracted=JSON.parse(raw);
   const names=[...new Set((Array.isArray(extracted.employee_names)?extracted.employee_names:[]).filter((n:unknown)=>typeof n==='string').map((n:string)=>n.trim()).filter(Boolean))].slice(0,60);
   const {data:profiles,error:profilesError}=await db.from('profiles').select('id,full_name').eq('status','approved').limit(2000);
   if(profilesError)throw profilesError;
   const matches:{letter_id:string,user_id:string,extracted_name:string,match_confidence:number}[]=[];
   const unmatched:string[]=[];
   for(const person of names){
    const normalized=normalize(person);
    if(normalized.length<5){unmatched.push(person);continue;}
    const exact=(profiles||[]).filter(p=>normalize(p.full_name||'')===normalized);
    // Only unambiguous full-name matches are preselected; fuzzy/ambiguous names require manual review.
    if(exact.length===1&&!matches.some(x=>x.user_id===exact[0].id)){
     matches.push({letter_id:letter.id,user_id:exact[0].id,extracted_name:person,match_confidence:1});
    }else unmatched.push(person);
   }
   if(matches.length){const {error:matchError}=await db.from('ziata_letter_recipients').upsert(matches,{onConflict:'letter_id,user_id'});if(matchError)throw matchError;}
   const ai_status=unmatched.length||!matches.length?'needs_review':'ready';
   const {error:updateError}=await db.from('ziata_smart_letters').update({
    letter_type:String(extracted.letter_type||'').slice(0,200),letter_number:String(extracted.letter_number||'').slice(0,100),
    letter_date:String(extracted.letter_date||'').slice(0,100),subject:String(extracted.subject||'').slice(0,1000),
    extracted_text:JSON.stringify({summary:String(extracted.summary||'').slice(0,2000),employee_names:names,unmatched_names:unmatched}),
    ai_status
   }).eq('id',letter.id);
   if(updateError)throw updateError;
   await db.from('ziata_letter_events').insert({letter_id:letter.id,action:'ai_extracted',details:{names:names.length,matched:matches.length,unmatched:unmatched.length}});
   return answer({ok:true,letter_id:letter.id,ai_status,matched:matches.length,unmatched:unmatched.length,notification_sent:false});
  }catch(err){
   console.error('AI extraction failed',err);
   await db.from('ziata_smart_letters').update({ai_status:'failed'}).eq('id',letter.id);
   return answer({error:'AI extraction failed; review function logs',letter_id:letter.id},502);
  }
 }catch(e){console.error('Ingestion failed',e);return answer({error:'Ingestion failed'},500);}
});
