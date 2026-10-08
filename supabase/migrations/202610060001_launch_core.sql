-- Apply to an isolated Supabase project first. No existing browser data is moved by this migration.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id),
  email text not null unique,
  display_name text not null default '',
  role text not null default 'free' check (role in ('free','paid','professional','supervisor','owner')),
  trial_ends_at timestamptz,
  subscription_tier text not null default 'none' check (subscription_tier in ('none','individual','professional')),
  subscription_status text not null default 'none',
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);
create function public.initialize_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.profiles(id,email,display_name,trial_ends_at)
    values(new.id,lower(new.email),left(coalesce(new.raw_user_meta_data->>'name',''),120),now()+interval '3 days')
    on conflict(id) do nothing;
  end if;
  return new;
end $$;
create trigger initialize_confirmed_profile after insert or update of email_confirmed_at on auth.users
for each row execute function public.initialize_profile();

create table public.workspaces (
  owner_id uuid primary key references public.profiles(id),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table public.entries (
  owner_id uuid not null references public.profiles(id),
  id text not null check(length(id) between 1 and 300),
  revision bigint not null default 0,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(owner_id,id)
);
create table public.entry_versions (
  owner_id uuid not null,
  entry_id text not null,
  revision bigint not null,
  payload jsonb not null,
  reason text not null,
  changed_at timestamptz not null default now(),
  primary key(owner_id,entry_id,revision),
  foreign key(owner_id,entry_id) references public.entries(owner_id,id)
);
create table public.learning_records (
  owner_id uuid not null references public.profiles(id),
  kind text not null check(kind in ('profile','exam-attempt','exam-result','weak-plan','brain-history','brain-resources','resource-saves','supervisors')),
  version bigint not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(owner_id,kind)
);
create table public.source_documents (
  owner_id uuid not null references public.profiles(id),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  object_path text not null unique,
  original_filename text not null,
  bytes bigint not null check(bytes between 1 and 26214400),
  created_at timestamptz not null default now(),
  primary key(owner_id,sha256)
);
create table public.supervisor_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entry_id text not null,
  entry_revision bigint not null,
  supervisor_email text not null,
  token_sha256 text not null unique check(token_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(owner_id,entry_id) references public.entries(owner_id,id)
);
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.supervisor_invitations(id),
  owner_id uuid not null,
  entry_id text not null,
  entry_revision bigint not null,
  supervisor_id uuid not null references public.profiles(id),
  status text not null check(status in ('VERIFIED','PENDING','REJECTED')),
  note text not null default '',
  approved_payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(owner_id,entry_id) references public.entries(owner_id,id)
);
create table public.subscription_events (
  stripe_event_id text primary key,
  customer_id text not null,
  event_created bigint not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_code text
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  invitation_id uuid references public.supervisor_invitations(id),
  recipient text not null,
  state text not null default 'queued' check(state in ('queued','sent','delivered','failed')),
  provider_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.entries enable row level security;
alter table public.entry_versions enable row level security;
alter table public.learning_records enable row level security;
alter table public.source_documents enable row level security;
alter table public.supervisor_invitations enable row level security;
alter table public.approvals enable row level security;
alter table public.subscription_events enable row level security;
alter table public.notifications enable row level security;
create policy profile_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy workspace_self on public.workspaces for select to authenticated using(owner_id=(select auth.uid()));
create policy entry_self on public.entries for select to authenticated using(owner_id=(select auth.uid()));
create policy version_self on public.entry_versions for select to authenticated using(owner_id=(select auth.uid()));
create policy learning_self on public.learning_records for select to authenticated using(owner_id=(select auth.uid()));
create policy document_self on public.source_documents for select to authenticated using(owner_id=(select auth.uid()));
create policy invitation_owner on public.supervisor_invitations for select to authenticated using(owner_id=(select auth.uid()));
create policy approval_self on public.approvals for select to authenticated using(owner_id=(select auth.uid()));
create policy notification_self on public.notifications for select to authenticated using(owner_id=(select auth.uid()));
-- All writes use narrowly scoped RPCs; users cannot grant themselves paid status or edit audit history.
revoke all on public.profiles,public.workspaces,public.entries,public.entry_versions,public.learning_records,public.source_documents,public.supervisor_invitations,public.approvals,public.subscription_events,public.notifications from anon,authenticated;
grant select on public.profiles,public.workspaces,public.entries,public.entry_versions,public.learning_records,public.source_documents,public.supervisor_invitations,public.approvals,public.notifications to authenticated;

create function public.save_learning(p_kind text,p_payload jsonb,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); current_version bigint;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'AUTH_REQUIRED'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception 'VERSION_CONFLICT'; end if;
 if p_payload is null or p_kind is null then raise exception 'INVALID_LEARNING_RECORD'; end if;
 if octet_length(p_payload::text)>1048576 then raise exception 'REQUEST_TOO_LARGE'; end if;
 insert into public.learning_records(owner_id,kind,payload) values(actor,p_kind,'null') on conflict do nothing;
 select version into current_version from public.learning_records where owner_id=actor and kind=p_kind for update;
 if current_version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
 update public.learning_records set payload=p_payload,version=version+1,updated_at=now() where owner_id=actor and kind=p_kind;
 return current_version+1;
end $$;
revoke all on function public.save_learning(text,jsonb,bigint) from public,anon;
grant execute on function public.save_learning(text,jsonb,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fieldwork-originals','fieldwork-originals',false,26214400,array['application/pdf','text/csv','application/json','text/plain','application/zip'])
on conflict(id) do nothing;
create policy original_read on storage.objects for select to authenticated
using(bucket_id='fieldwork-originals' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy original_insert on storage.objects for insert to authenticated
with check(bucket_id='fieldwork-originals' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Originals are immutable: no client update/delete policy. Short-lived downloads require the same owner.
commit;
