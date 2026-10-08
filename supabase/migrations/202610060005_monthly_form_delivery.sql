begin;
-- Only delivery hashes are retained. The form itself is not made public or stored here.
create table if not exists public.monthly_form_deliveries (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);
alter table public.monthly_form_deliveries enable row level security;
revoke all on public.monthly_form_deliveries from anon, authenticated;

create or replace function public.reserve_monthly_form_email(p_request_id uuid, p_content_hash text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare actor uuid := auth.uid(); prior public.monthly_form_deliveries;
begin
  if actor is null or not exists (select 1 from auth.users where id=actor and email_confirmed_at is not null)
    or not exists (select 1 from public.profiles where id=actor and subscription_status='active' and subscription_tier in ('individual','professional','enterprise')) then
    raise exception 'PAID_SUBSCRIPTION_REQUIRED';
  end if;
  if p_request_id is null or p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_EMAIL_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 527));
  select * into prior from public.monthly_form_deliveries where owner_id=actor and request_id=p_request_id;
  if found then
    if prior.content_hash <> p_content_hash then raise exception 'EMAIL_REQUEST_CONFLICT'; end if;
    if prior.created_at < now()-interval '23 hours' then raise exception 'EMAIL_REQUEST_EXPIRED'; end if;
    return p_request_id;
  end if;
  if (select count(*) from public.monthly_form_deliveries where owner_id=actor and created_at>now()-interval '24 hours') >= 10 then raise exception 'FORM_EMAIL_LIMIT'; end if;
  insert into public.monthly_form_deliveries(owner_id,request_id,content_hash) values(actor,p_request_id,p_content_hash);
  return p_request_id;
end;
$$;
revoke all on function public.reserve_monthly_form_email(uuid,text) from public, anon;
grant execute on function public.reserve_monthly_form_email(uuid,text) to authenticated;
commit;
