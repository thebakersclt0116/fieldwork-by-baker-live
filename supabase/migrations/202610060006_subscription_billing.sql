begin;
create table if not exists public.billing_customers (
 owner_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('live','test')),
 customer_id text not null check(customer_id ~ '^cus_[A-Za-z0-9]+$'),
 created_at timestamptz not null default now(),
 primary key(owner_id,mode), unique(customer_id,mode)
);
create table if not exists public.billing_subscriptions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('live','test')),
 subscription_id text not null check(subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 customer_id text not null,
 plan text not null check(plan in ('individual_monthly','professional_monthly','professional_annual','none')),
 status text not null check(status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
 period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 checked_at bigint not null,
 primary key(subscription_id,mode),
 foreign key(customer_id,mode) references public.billing_customers(customer_id,mode)
);
create table if not exists public.billing_events (
 mode text not null check(mode in ('live','test')),
 event_id text not null,
 processed_at timestamptz not null default now(),
 primary key(mode,event_id)
);
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_customers,public.billing_subscriptions,public.billing_events from anon,authenticated;
grant select on public.billing_customers,public.billing_subscriptions to authenticated;
drop policy if exists own_billing_customer on public.billing_customers;
create policy own_billing_customer on public.billing_customers for select to authenticated using(owner_id=auth.uid());
drop policy if exists own_billing_subscription on public.billing_subscriptions;
create policy own_billing_subscription on public.billing_subscriptions for select to authenticated using(owner_id=auth.uid());

create or replace function public.link_billing_customer(p_owner uuid,p_mode text,p_customer text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare prior text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'BILLING_SERVER_REQUIRED'; end if;
 if p_mode not in ('live','test') or p_customer !~ '^cus_[A-Za-z0-9]+$' or not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then raise exception 'INVALID_BILLING_CUSTOMER'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_mode,621));
 select customer_id into prior from public.billing_customers where owner_id=p_owner and mode=p_mode;
 if found then
  if prior<>p_customer then raise exception 'BILLING_CUSTOMER_CONFLICT'; end if;
  return prior;
 end if;
 insert into public.billing_customers(owner_id,mode,customer_id) values(p_owner,p_mode,p_customer);
 return p_customer;
end;
$$;

create or replace function public.apply_billing_snapshot(p_owner uuid,p_mode text,p_customer text,p_subscription text,p_plan text,p_status text,p_period_end bigint,p_cancel_at_period_end boolean,p_checked_at bigint,p_event_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.billing_subscriptions; chosen public.billing_subscriptions;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'BILLING_SERVER_REQUIRED'; end if;
 if p_mode not in ('live','test') or p_event_id is null or length(p_event_id)>200 or p_checked_at is null or p_checked_at<0 or p_subscription !~ '^sub_[A-Za-z0-9]+$' or p_plan not in ('individual_monthly','professional_monthly','professional_annual','none') or p_status not in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused') then raise exception 'INVALID_BILLING_SNAPSHOT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_mode,621));
 if not exists(select 1 from public.billing_customers where owner_id=p_owner and mode=p_mode and customer_id=p_customer) then raise exception 'BILLING_CUSTOMER_CONFLICT'; end if;
 if exists(select 1 from public.billing_events where mode=p_mode and event_id=p_event_id) then return jsonb_build_object('duplicate',true); end if;
 select * into prior from public.billing_subscriptions where subscription_id=p_subscription and mode=p_mode;
 if found and (prior.owner_id<>p_owner or prior.customer_id<>p_customer) then raise exception 'BILLING_CUSTOMER_CONFLICT'; end if;
 if found and prior.checked_at>p_checked_at then return jsonb_build_object('stale',true); end if;
 insert into public.billing_subscriptions(owner_id,mode,subscription_id,customer_id,plan,status,period_end,cancel_at_period_end,checked_at)
 values(p_owner,p_mode,p_subscription,p_customer,p_plan,p_status,case when p_period_end is null then null else to_timestamp(p_period_end) end,coalesce(p_cancel_at_period_end,false),p_checked_at)
 on conflict(subscription_id,mode) do update set plan=excluded.plan,status=excluded.status,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,checked_at=excluded.checked_at;
 insert into public.billing_events(mode,event_id) values(p_mode,p_event_id);
 -- Sandbox purchases cannot grant production features. Only live snapshots update the profile.
 if p_mode='live' then
  select * into chosen from public.billing_subscriptions where owner_id=p_owner and mode='live'
   order by case when status='active' and plan<>'none' then 0 when status='trialing' and plan<>'none' then 1 else 2 end,checked_at desc limit 1;
  update public.profiles set subscription_tier=case when chosen.plan='individual_monthly' then 'individual' when chosen.plan in ('professional_monthly','professional_annual') then 'professional' else 'none' end,
   subscription_status=chosen.status where id=p_owner;
 end if;
 return jsonb_build_object('saved',true);
end;
$$;
revoke all on function public.link_billing_customer(uuid,text,text) from public,anon,authenticated;
revoke all on function public.apply_billing_snapshot(uuid,text,text,text,text,text,bigint,boolean,bigint,text) from public,anon,authenticated;
grant execute on function public.link_billing_customer(uuid,text,text) to service_role;
grant execute on function public.apply_billing_snapshot(uuid,text,text,text,text,text,bigint,boolean,bigint,text) to service_role;

create table if not exists public.billing_checkout_claims (
 owner_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('live','test')),
 request_id uuid not null,
 plan text not null,
 origin text not null,
 expires_at timestamptz not null,
 primary key(owner_id,mode)
);
alter table public.billing_checkout_claims enable row level security;
revoke all on public.billing_checkout_claims from anon,authenticated;
create or replace function public.claim_billing_checkout(p_owner uuid,p_mode text,p_plan text,p_origin text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare claim public.billing_checkout_claims;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'BILLING_SERVER_REQUIRED'; end if;
 if p_mode not in ('live','test') or p_plan not in ('individual_monthly','professional_monthly','professional_annual') or p_origin !~ '^https://[a-zA-Z0-9.-]+$' or not exists(select 1 from public.billing_customers where owner_id=p_owner and mode=p_mode) then raise exception 'INVALID_BILLING_CHECKOUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_mode,621));
 select * into claim from public.billing_checkout_claims where owner_id=p_owner and mode=p_mode;
 if found and claim.expires_at>now() then
  if claim.plan<>p_plan then raise exception 'CHECKOUT_ALREADY_OPEN'; end if;
  return jsonb_build_object('id',claim.request_id,'origin',claim.origin,'expiresAt',floor(extract(epoch from claim.expires_at)));
 end if;
 insert into public.billing_checkout_claims(owner_id,mode,request_id,plan,origin,expires_at)
 values(p_owner,p_mode,gen_random_uuid(),p_plan,p_origin,now()+interval '35 minutes')
 on conflict(owner_id,mode) do update set request_id=excluded.request_id,plan=excluded.plan,origin=excluded.origin,expires_at=excluded.expires_at
 returning * into claim;
 return jsonb_build_object('id',claim.request_id,'origin',claim.origin,'expiresAt',floor(extract(epoch from claim.expires_at)));
end;
$$;
revoke all on function public.claim_billing_checkout(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_billing_checkout(uuid,text,text,text) to service_role;
commit;
