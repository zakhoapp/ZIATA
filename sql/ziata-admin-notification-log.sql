-- ZIATA: read-only unified notification delivery ledger for approved administrators.
-- Historical entries are derived from persisted recipient records, not from push delivery receipts.
create or replace function public.ziata_admin_notification_log(
 p_kind text default 'all', p_limit integer default 200
)
returns table (
 source_type text, source_id text, recipient_id uuid, recipient_name text,
 title text, detail text, sent_at timestamptz, is_read boolean,
 delivery_status text
)
language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.is_admin=true and p.status='approved'
 ) then raise exception 'Admin required' using errcode='42501'; end if;
 if p_kind not in ('all','announcement','leave','letter') then
  raise exception 'Invalid filter'; end if;
 return query
 select x.source_type,x.source_id,x.recipient_id,p.full_name::text,
 x.title,x.detail,x.sent_at,x.is_read,x.delivery_status
 from (
  select 'announcement'::text as source_type,
   ar.announcement_id::text as source_id,ar.user_id as recipient_id,
   a.title::text as title,left(a.body::text,300) as detail,
   a.created_at as sent_at,coalesce(ar.is_read,false) as is_read,
   'recorded'::text as delivery_status
  from public.ziata_announcement_recipients ar
  join public.ziata_announcements a on a.id=ar.announcement_id
  where p_kind in ('all','announcement')
  union all
  select 'leave'::text,n.id::text,n.user_id,n.title::text,
   left(n.body::text,300),n.created_at,coalesce(n.is_read,false),'recorded'::text
  from public.ziata_leave_notifications n
  where p_kind in ('all','leave')
  union all
  select 'letter'::text,n.letter_id::text,n.user_id,
   coalesce(l.subject,l.drive_name)::text,l.drive_name::text,
   n.created_at,n.is_read,'recorded'::text
  from public.ziata_smart_letter_notifications n
  join public.ziata_smart_letters l on l.id=n.letter_id
  where p_kind in ('all','letter') and l.approval_status='approved'
 ) x
 left join public.profiles p on p.id=x.recipient_id
 order by x.sent_at desc
 limit least(greatest(coalesce(p_limit,200),1),1000);
end $$;
revoke all on function public.ziata_admin_notification_log(text,integer) from public,anon;
grant execute on function public.ziata_admin_notification_log(text,integer) to authenticated;
