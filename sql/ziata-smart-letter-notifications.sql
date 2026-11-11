-- ZIATA Smart Letters: in-app notifications. Run in Supabase SQL Editor.
create table if not exists public.ziata_smart_letter_notifications (
 id bigint generated always as identity primary key,
 letter_id uuid not null references public.ziata_smart_letters(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 is_read boolean not null default false,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(letter_id,user_id)
);
create index if not exists ziata_sln_user_idx on public.ziata_smart_letter_notifications(user_id,is_read,created_at desc);
alter table public.ziata_smart_letter_notifications enable row level security;
drop policy if exists "Read own smart letter notifications" on public.ziata_smart_letter_notifications;
create policy "Read own smart letter notifications" on public.ziata_smart_letter_notifications
 for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Mark own smart letter notifications read" on public.ziata_smart_letter_notifications;
create policy "Mark own smart letter notifications read" on public.ziata_smart_letter_notifications
 for update to authenticated using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
revoke all on public.ziata_smart_letter_notifications from anon;
grant select on public.ziata_smart_letter_notifications to authenticated;
grant update(is_read,read_at) on public.ziata_smart_letter_notifications to authenticated;
-- The recipient rows and letter approval can be committed in either order.
-- A notification is created only when BOTH conditions are true.
create or replace function public.ziata_sln_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_table_name = 'ziata_letter_recipients' then
  if new.approved is true and exists (
   select 1 from public.ziata_smart_letters l
   where l.id = new.letter_id and l.approval_status = 'approved'
  ) then
   insert into public.ziata_smart_letter_notifications(letter_id,user_id)
   values(new.letter_id,new.user_id) on conflict(letter_id,user_id) do nothing;
  end if;
 else
  if new.approval_status = 'approved' then
   insert into public.ziata_smart_letter_notifications(letter_id,user_id)
   select r.letter_id,r.user_id from public.ziata_letter_recipients r
   where r.letter_id = new.id and r.approved is true
   on conflict(letter_id,user_id) do nothing;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists ziata_sln_recipient_trigger on public.ziata_letter_recipients;
create trigger ziata_sln_recipient_trigger after insert or update of approved
 on public.ziata_letter_recipients for each row execute function public.ziata_sln_sync();
drop trigger if exists ziata_sln_letter_trigger on public.ziata_smart_letters;
create trigger ziata_sln_letter_trigger after update of approval_status
 on public.ziata_smart_letters for each row execute function public.ziata_sln_sync();
-- Backfill approved records (including test records), safely idempotent.
insert into public.ziata_smart_letter_notifications(letter_id,user_id)
select r.letter_id,r.user_id
from public.ziata_letter_recipients r
join public.ziata_smart_letters l on l.id=r.letter_id
where r.approved is true and l.approval_status='approved'
on conflict(letter_id,user_id) do nothing;
select count(*) as notifications_total from public.ziata_smart_letter_notifications;

-- Expose only the approved letters assigned to the signed-in employee.
create or replace function public.ziata_my_smart_letter_notifications()
returns table (
 id bigint, letter_id uuid, is_read boolean, created_at timestamptz,
 drive_name text, drive_url text, subject text, letter_number text, letter_date text
)
language sql stable security definer set search_path = ''
as $$
 select n.id,n.letter_id,n.is_read,n.created_at,
 l.drive_name::text,l.drive_url::text,l.subject::text,
 l.letter_number::text,l.letter_date::text
 from public.ziata_smart_letter_notifications n
 join public.ziata_smart_letters l on l.id=n.letter_id
 where n.user_id=(select auth.uid()) and l.approval_status='approved'
 order by n.created_at desc limit 100
$$;
revoke all on function public.ziata_my_smart_letter_notifications() from public,anon;
grant execute on function public.ziata_my_smart_letter_notifications() to authenticated;
