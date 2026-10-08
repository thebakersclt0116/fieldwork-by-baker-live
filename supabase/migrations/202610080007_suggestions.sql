begin;
-- Quota metadata only; suggestion text is sent to the team's inboxes.
create table if not exists public.suggestion_requests (
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),primary key(owner_id,request_id)
);
alter table public.suggestion_requests enable row level security;
revoke all on public.suggestion_requests from anon,authenticated;
create or replace function public.reserve_suggestion(p_request_id uuid,p_content_hash text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); existing public.suggestion_requests%rowtype;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'AUTH_REQUIRED';end if;
 if p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$' or p_request_id is null then raise exception 'INVALID_SUGGESTION';end if;
 perform pg_advisory_xact_lock(hashtextextended('suggestion/'||uid::text,0));
 select * into existing from public.suggestion_requests where owner_id=uid and request_id=p_request_id;
 if found then
  if existing.content_hash<>p_content_hash or existing.created_at<now()-interval '23 hours' then return 'SUGGESTION_CONFLICT';end if;
  return 'RESERVED';
 end if;
 if(select count(*) from public.suggestion_requests where owner_id=uid and created_at>now()-interval '24 hours')>=5 then return 'SUGGESTION_LIMIT';end if;
 insert into public.suggestion_requests(owner_id,request_id,content_hash) values(uid,p_request_id,p_content_hash);
 return 'RESERVED';
end $$;
revoke all on function public.reserve_suggestion(uuid,text) from public,anon;
grant execute on function public.reserve_suggestion(uuid,text) to authenticated;
commit;
