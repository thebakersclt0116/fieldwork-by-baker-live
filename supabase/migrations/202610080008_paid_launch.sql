begin;
create or replace function public.initialize_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null then
  insert into public.profiles(id,email,display_name,trial_ends_at) values(new.id,lower(new.email),left(coalesce(new.raw_user_meta_data->>'name',''),120),null) on conflict(id) do nothing;
 end if;
 return new;
end $$;
create function public.require_paid_workspace_write() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if tg_table_name='entries' and actor is not null and (case when tg_op='DELETE' then old.owner_id else new.owner_id end)<>actor then
  if tg_op='DELETE' then return old;end if;return new;
 end if;
 if actor is not null and not exists(select 1 from public.profiles where id=actor and role='owner') and not exists(select 1 from public.billing_subscriptions where owner_id=actor and mode='live' and status='active' and plan<>'none') then raise exception 'PAID_SUBSCRIPTION_REQUIRED';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger paid_entry_writes before insert or update or delete on public.entries for each row execute function public.require_paid_workspace_write();
create trigger paid_original_writes before insert or update on public.source_documents for each row execute function public.require_paid_workspace_write();
create trigger paid_import_writes before insert or update on public.import_journals for each row execute function public.require_paid_workspace_write();
create trigger paid_upload_intents before insert or update on public.upload_intents for each row execute function public.require_paid_workspace_write();
-- Existing reads and private original downloads stay available.
create table public.launch_notifications(id text primary key,owner_id uuid not null references public.profiles(id),kind text not null,plan text not null,email text not null,display_name text not null,created_at timestamptz not null default now(),sent_at timestamptz);
alter table public.launch_notifications enable row level security;
revoke all on public.launch_notifications from public,anon,authenticated;
grant select,update on public.launch_notifications to service_role;
create function public.enqueue_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.launch_notifications(id,owner_id,kind,plan,email,display_name) values('signup/'||new.id,new.id,'signup','No membership selected',new.email,new.display_name) on conflict do nothing;return new;
end $$;
create trigger launch_signup_email after insert on public.profiles for each row execute function public.enqueue_new_user();
create function public.enqueue_paid_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.mode='live' and new.status='active' and new.plan<>'none' then
  insert into public.launch_notifications(id,owner_id,kind,plan,email,display_name)
  select 'paid/'||new.subscription_id||'/'||new.plan,new.owner_id,'subscription',new.plan,email,display_name from public.profiles where id=new.owner_id on conflict do nothing;
 end if;return new;
end $$;
create trigger launch_subscription_email after insert or update on public.billing_subscriptions for each row execute function public.enqueue_paid_user();
commit;
