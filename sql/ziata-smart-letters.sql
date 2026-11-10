-- ZIATA Smart Letters: run in Supabase SQL Editor before enabling the UI.
create table if not exists public.ziata_smart_letters (
 id uuid primary key default gen_random_uuid(),
 drive_file_id text not null unique,
 drive_name text not null,
 drive_mime text,
 drive_url text not null,
 source_modified_at timestamptz,
 letter_type text,
 letter_number text,
 letter_date text,
 subject text,
 extracted_text text,
 ai_status text not null default 'pending' check (ai_status in ('pending','processing','ready','needs_review','failed')),
 approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.ziata_letter_recipients (
 id uuid primary key default gen_random_uuid(),
 letter_id uuid not null references public.ziata_smart_letters(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 extracted_name text,
 match_confidence numeric(5,4),
 approved boolean not null default false,
 notification_status text not null default 'not_sent' check(notification_status in ('not_sent','queued','sent','failed')),
 notified_at timestamptz,
 unique(letter_id,user_id)
);
create table if not exists public.ziata_letter_events (
 id bigint generated always as identity primary key,
 letter_id uuid not null references public.ziata_smart_letters(id) on delete cascade,
 actor_id uuid references auth.users(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists ziata_smart_letters_review_idx on public.ziata_smart_letters(approval_status,created_at desc);
create index if not exists ziata_letter_recipients_user_idx on public.ziata_letter_recipients(user_id,letter_id);
alter table public.ziata_smart_letters enable row level security;
alter table public.ziata_letter_recipients enable row level security;
alter table public.ziata_letter_events enable row level security;
-- No client-side write policy: ingestion and approval must use authenticated server functions.
-- Admin read access only, plus a recipient's approved letters.
create policy "smart_letters_admin_read" on public.ziata_smart_letters for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true and p.status='approved')
 or (approval_status='approved' and exists(select 1 from public.ziata_letter_recipients r where r.letter_id=id and r.user_id=auth.uid() and r.approved=true))
);
create policy "smart_recipients_admin_read" on public.ziata_letter_recipients for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true and p.status='approved')
 or (user_id=auth.uid() and approved=true)
);
create policy "smart_events_admin_read" on public.ziata_letter_events for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true and p.status='approved')
);
-- IMPORTANT: Drive links must also be access-controlled. Never share confidential files publicly.
