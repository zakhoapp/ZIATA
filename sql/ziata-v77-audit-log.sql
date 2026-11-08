-- ZIATA V77: tamper-resistant, admin-readable database audit
-- Apply once in Supabase SQL Editor. Existing application records are NOT modified.
-- IMPORTANT: Only changes after trigger installation are recorded.
create table if not exists public.ziata_audit_events (
  id bigint generated always as identity primary key,
  happened_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  actor_email text,
  system_name text not null,
  entity_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  before_data jsonb,
  after_data jsonb,
  changed_fields text[] not null default '{}'
);
create index if not exists ziata_audit_events_time_idx on public.ziata_audit_events(happened_at desc,id desc);
create index if not exists ziata_audit_events_actor_idx on public.ziata_audit_events(actor_id,happened_at desc);
create index if not exists ziata_audit_events_system_idx on public.ziata_audit_events(system_name,happened_at desc);

create or replace function public.ziata_audit_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'approved' and p.is_admin is true
 );
$$;
revoke all on function public.ziata_audit_is_admin() from public, anon;
grant execute on function public.ziata_audit_is_admin() to authenticated;

alter table public.ziata_audit_events enable row level security;
drop policy if exists ziata_audit_admin_read on public.ziata_audit_events;
create policy ziata_audit_admin_read on public.ziata_audit_events
for select to authenticated using (public.ziata_audit_is_admin());
-- No INSERT/UPDATE/DELETE policies. Database triggers use SECURITY DEFINER.
revoke all on public.ziata_audit_events from public, anon, authenticated;
grant select on public.ziata_audit_events to authenticated;

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
 from (select pg_catalog.jsonb_object_keys(pg_catalog.coalesce(oldj,'{}'::jsonb)||pg_catalog.coalesce(newj,'{}'::jsonb)) as k) names
 where oldj->k is distinct from newj->k;
 if TG_OP = 'UPDATE' and pg_catalog.coalesce(pg_catalog.array_length(changed,1),0) = 0 then return NEW; end if;
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
revoke all on function public.ziata_audit_capture() from public, anon, authenticated;

-- Audit known Supabase tables if present. Google Apps Script-backed
-- Transactions/Engineers/Projects/Letters are NOT covered until migrated
-- or their server-side write endpoints are instrumented.
do $$
declare row_record record;
begin
 for row_record in
 select * from (values
  ('ziata_committee_records','committees'),
  ('profiles','accounts'),
  ('user_permissions','permissions'),
  ('ziata_leave_requests','permits'),
  ('ziata_leave_decisions','permits'),
  ('ziata_announcements','announcements'),
  ('ziata_announcement_recipients','announcements'),
  ('ziata_projects','projects'),
  ('ziata_letters','letters'),
  ('ziata_transactions','transactions'),
  ('ziata_engineers','engineers')
 ) t(table_name,system_name)
 loop
  if to_regclass(format('public.%I',row_record.table_name)) is not null then
   execute format('drop trigger if exists ziata_audit_v77 on public.%I',row_record.table_name);
   execute format(
    'create trigger ziata_audit_v77 after insert or update or delete on public.%I for each row execute function public.ziata_audit_capture(%L)',
    row_record.table_name,row_record.system_name
   );
  end if;
 end loop;
end $$;

-- Verify installation:
select event_object_table,trigger_name from information_schema.triggers
where trigger_name = 'ziata_audit_v77' order by event_object_table;
