/**
 * ZIATA Smart Letters Google Drive watcher.
 * Install in script.google.com under an account with access to the folder.
 * Script Properties required:
 * ZIATA_INGEST_SECRET = same value as Supabase Edge Function secret
 * ZIATA_INGEST_URL = https://<project-ref>.supabase.co/functions/v1/ziata-letter-ingest
 * The secret must NEVER be stored in this source file.
 */
const ZIATA_FOLDER_ID='1tSrWXetDrfQHQrOV5bKheXqCP_BbqwTD';
const MIME_OK={'application/pdf':true,'image/jpeg':true,'image/png':true};
function ziataInitializeWatcher(){
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('ZIATA_INGEST_SECRET')||!props.getProperty('ZIATA_INGEST_URL'))throw Error('Set both Script Properties first');
 const folder=DriveApp.getFolderById(ZIATA_FOLDER_ID);
 const files=folder.getFiles();let count=0;
 // Baseline existing files, do not notify retroactively.
 while(files.hasNext()){const f=files.next();props.setProperty('ziata_seen_'+f.getId(),'baseline');count++;}
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='ziataScanNewLetters').forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('ziataScanNewLetters').timeBased().everyMinutes(5).create();
 Logger.log('Initialized. Existing files excluded: '+count);
}
function ziataScanNewLetters(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1000))return;
 try{
  const props=PropertiesService.getScriptProperties(),secret=props.getProperty('ZIATA_INGEST_SECRET'),url=props.getProperty('ZIATA_INGEST_URL');
  if(!secret||!url)throw Error('Missing Script Properties');
  const files=DriveApp.getFolderById(ZIATA_FOLDER_ID).getFiles();
  let sent=0,skipped=0;
  while(files.hasNext()){
   const f=files.next(),id=f.getId(),key='ziata_seen_'+id;
   if(props.getProperty(key)){skipped++;continue;}
   const mime=f.getMimeType();
   if(!MIME_OK[mime]){props.setProperty(key,'unsupported');continue;}
   const blob=f.getBlob(),bytes=blob.getBytes();
   if(bytes.length>12*1024*1024){props.setProperty(key,'oversize');continue;}
   const response=UrlFetchApp.fetch(url,{
    method:'post',contentType:'application/json',
    headers:{'x-ziata-ingest-secret':secret},
    payload:JSON.stringify({file_id:id,name:f.getName(),mime,base64:Utilities.base64Encode(bytes)}),
    muteHttpExceptions:true
   });
   const status=response.getResponseCode();
   if(status>=200&&status<300){props.setProperty(key,'processed');sent++;}
   else {Logger.log('Failed '+f.getName()+': HTTP '+status+' '+response.getContentText().slice(0,250));}
  }
  Logger.log('Processed: '+sent+'; skipped: '+skipped);
 }finally{lock.releaseLock();}
}
