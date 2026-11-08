-- ZIATA V80 hotfix: repair existing audit trigger without changing data or policies.
-- Run this SQL once in Supabase SQL Editor, then retry saving the committee record.
create or replace function public.ziata_audit_capture()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
 oldj jsonb;
 newj jsonb;
 changed text[];
 target_key text;
 actor uuid;
 mail text;
begin
 -- Do not store passwords, tokens, profile photos, or unbounded sensitive data.
 -- Track a defined allowlist of fields per audited table.
 if TG_TABLE_NAME = 'profiles' then
  oldj := case when TG_OP = 'INSERT' then null else pg_catalog.jsonb_build_object('full_name',OLD.full_name,'department',OLD.department,'status',OLD.status,'is_admin',OLD.is_admin) end;
  newj := case when TG_OP = 'DELETE' then null else pg_catalog.jsonb_build_object('full_name',NEW.full_name,'department',NEW.department,'status',NEW.status,'is_admin',NEW.is_admin) end;
 elsif TG_TABLE_NAME = 'user_permissions' then
  oldj := case when TG_OP = 'INSERT' then null else pg_catalog.jsonb_build_object('system_key',OLD.system_key,'can_access',OLD.can_access) end;
  newj := case when TG_OP = 'DELETE' then null else pg_catalog.jsonb_build_object('system_key',NEW.system_key,'can_access',NEW.can_access) end;
 else
  oldj := case when TG_OP = 'INSERT' then null else pg_catalog.to_jsonb(OLD) end;
  newj := case when TG_OP = 'DELETE' then null else pg_catalog.to_jsonb(NEW) end;
  -- Exclude common private, authentication and attachment payloads.
  oldj := oldj - array['password','password_hash','token','access_token','refresh_token','secret','api_key','avatar_path','phone','email','attachments','attachment','file_url','document_url','medical_notes','notes'];
  newj := newj - array['password','password_hash','token','access_token','refresh_token','secret','api_key','avatar_path','phone','email','attachments','attachment','file_url','document_url','medical_notes','notes'];
 end if;
 select pg_catalog.array_agg(k order by k) into changed
 from (select pg_catalog.jsonb_object_keys(coalesce(oldj,'{}'::jsonb)||coalesce(newj,'{}'::jsonb)) as k) names
 where oldj->k is distinct from newj->k;
 if TG_OP = 'UPDATE' and coalesce(pg_catalog.array_length(changed,1),0) = 0 then return NEW; end if;
 actor := auth.uid();
 mail := nullif(auth.jwt()->>'email','');
 target_key := coalesce(newj->>'id', oldj->>'id',
   newj->>'request_id',oldj->>'request_id',
   newj->>'user_id',oldj->>'user_id',
   newj->>'employee_id',oldj->>'employee_id','');
 insert into public.ziata_audit_events
 (actor_id,actor_email,system_name,entity_name,record_id,operation,before_data,after_data,changed_fields)
 values (actor,mail,TG_ARGV[0],TG_TABLE_NAME,target_key,TG_OP,oldj,newj,coalesce(changed,'{}'::text[]));
 if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

-- Existing triggers will use this updated function immediately.
