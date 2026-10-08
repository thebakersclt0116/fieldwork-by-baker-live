begin;
create table public.community_profiles(owner_id uuid primary key references public.profiles(id),country text not null default 'NONE' check(country in ('US','AU','GB','OTHER','NONE')),show_country boolean not null default false,share_presence boolean not null default false,last_active_at timestamptz);
alter table public.community_profiles enable row level security;
revoke all on public.community_profiles from public,anon,authenticated;
grant select on public.community_profiles to authenticated;
create policy community_self_read on public.community_profiles for select to authenticated using(owner_id=auth.uid());
-- Only RPCs can modify preferences or server-issued activity timestamps.
create function public.save_community_preferences(p_country text,p_show_country boolean,p_share_presence boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'AUTH_REQUIRED';end if;
 insert into public.community_profiles(owner_id,country,show_country,share_presence) values(auth.uid(),p_country,p_show_country,p_share_presence) on conflict(owner_id) do update set country=excluded.country,show_country=excluded.show_country,share_presence=excluded.share_presence,last_active_at=case when excluded.share_presence then community_profiles.last_active_at else null end;
end $$;
create function public.community_heartbeat() returns void language plpgsql security definer set search_path='' as $$
begin update public.community_profiles set last_active_at=now() where owner_id=auth.uid() and share_presence;end $$;
create function public.community_members() returns table(member_id uuid,display_name text,country text,active_now boolean) language sql security definer set search_path='' as $$
 select c.owner_id,p.display_name,case when c.show_country then c.country else 'NONE' end,c.share_presence and c.last_active_at>now()-interval '2 minutes'
 from public.community_profiles c join public.profiles p on p.id=c.owner_id
 where auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid()) and (c.show_country or c.share_presence)
 order by c.owner_id limit 100;
$$;
revoke all on function public.save_community_preferences(text,boolean,boolean),public.community_heartbeat(),public.community_members() from public,anon;
grant execute on function public.save_community_preferences(text,boolean,boolean),public.community_heartbeat(),public.community_members() to authenticated;
commit;
