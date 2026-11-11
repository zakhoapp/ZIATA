-- Run once in Supabase SQL Editor.
-- Employees may maintain only their own committee/project membership rows.
-- Do not grant blanket UPDATE on the official table.
create or replace function public.ziata_my_official_membership(
 p_action text,
 p_record_id bigint default null,
 p_committee text default '',
 p_projects text default '',
 p_notes text default ''
) returns bigint
language plpgsql security definer set search_path=''
as $$
declare
 v_uid uuid := auth.uid();
 v_name text;
 v_id bigint;
 v_is_admin boolean;
begin
 select p.full_name,p.is_admin into v_name,v_is_admin
 from public.profiles p where p.id=v_uid and p.status='approved';
 if v_uid is null or v_name is null then raise exception 'Approved account required'; end if;
 if p_action not in ('create','update') then raise exception 'Unsupported action'; end if;
 if length(btrim(p_committee))>250 or length(p_projects)>3000 or length(p_notes)>1500 then raise exception 'Input too long'; end if;
 if btrim(p_committee)='' and btrim(p_projects)='' then raise exception 'Choose a committee or project'; end if;
 if p_action='create' then
   insert into public.ziata_committee_records(staff_name,employee_id,committee_type,projects_text,notes)
   values (v_name,v_uid,btrim(p_committee),btrim(p_projects),btrim(p_notes))
   returning id into v_id;
 else
   if p_record_id is null then raise exception 'Missing record id'; end if;
   update public.ziata_committee_records
   set committee_type=btrim(p_committee),projects_text=btrim(p_projects),notes=btrim(p_notes)
   where id=p_record_id and employee_id=v_uid
   returning id into v_id;
   if v_id is null then raise exception 'Record not found or not owned'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.ziata_my_official_membership(text,bigint,text,text,text) from public,anon;
grant execute on function public.ziata_my_official_membership(text,bigint,text,text,text) to authenticated;
-- NOTE: This RPC writes only official membership fields. Personal status
-- remains in ziata_professional_entries until a status column is added to official records.
