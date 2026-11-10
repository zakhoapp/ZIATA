-- ZIATA: reversible archive of finalized leave requests (no physical DELETE).
alter table public.ziata_leave_requests
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

create or replace function public.ziata_archive_leave_request(p_request_id bigint, p_restore boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_final text;
begin
  select coalesce(is_admin,false) and status='approved'
    into v_admin
  from public.profiles where id=auth.uid();
  if coalesce(v_admin,false) is not true then
    raise exception 'Admin permission required';
  end if;

  perform 1 from public.ziata_leave_requests where id=p_request_id for update;
  if not found then raise exception 'Leave request not found'; end if;

  select decision into v_final
  from public.ziata_leave_decisions
  where request_id=p_request_id and role='deputy'
  limit 1;
  if v_final not in ('approved','rejected') or v_final is null then
    raise exception 'Only finalized leave requests can be archived';
  end if;

  if p_restore then
    update public.ziata_leave_requests
       set archived_at=null, archived_by=null
     where id=p_request_id;
  else
    update public.ziata_leave_requests
       set archived_at=now(), archived_by=auth.uid()
     where id=p_request_id and archived_at is null;
  end if;
end;
$$;
revoke all on function public.ziata_archive_leave_request(bigint,boolean) from public,anon;
grant execute on function public.ziata_archive_leave_request(bigint,boolean) to authenticated;
-- The original leave request and its decisions stay in the existing Supabase tables.
