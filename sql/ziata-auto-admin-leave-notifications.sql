-- ZIATA: automatically notify approved admins for every NEW leave request.
-- Existing manager/secretary/deputy notification routing is left unchanged.
-- Run once in Supabase SQL Editor. No manual SQL needed for later requests.
create or replace function public.ziata_notify_admin_new_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin record;
begin
  -- Serialize notification creation per request, to avoid concurrent duplicates.
  perform pg_catalog.pg_advisory_xact_lock(918801, new.id::integer);

  for v_admin in
    select p.id from public.profiles p
    where p.is_admin is true and p.status = 'approved'
  loop
    if not exists (
      select 1 from public.ziata_leave_notifications n
      where n.request_id = new.id and n.user_id = v_admin.id
    ) then
      insert into public.ziata_leave_notifications
        (request_id, user_id, title, body)
      values (
        new.id, v_admin.id,
        'ZIATA — داخوازا نوی یا مولەتێ',
        'داخوازا مولەتێ ژ لایێ ' || coalesce(new.employee_name::text, 'فەرمانبەری') ||
        ' هاتیە تۆمارکرن. ژمارا داخوازێ: ' || new.id::text
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists ziata_admin_new_leave_notification on public.ziata_leave_requests;
create trigger ziata_admin_new_leave_notification
after insert on public.ziata_leave_requests
for each row
execute function public.ziata_notify_admin_new_leave();

-- Confirm the trigger is installed (read-only).
select tgname as trigger_name, tgenabled as enabled
from pg_catalog.pg_trigger
where tgrelid = 'public.ziata_leave_requests'::regclass
  and tgname = 'ziata_admin_new_leave_notification';
