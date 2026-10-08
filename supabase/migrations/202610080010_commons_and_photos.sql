begin;
create function public.community_verified() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null);
$$;
create function public.community_paid() returns boolean language sql stable security definer set search_path='' as $$
 select public.community_verified() and (exists(select 1 from public.profiles where id=auth.uid() and role='owner') or exists(select 1 from public.billing_subscriptions where owner_id=auth.uid() and mode='live' and status='active' and plan in ('individual_monthly','professional_monthly','professional_annual')));
$$;
create table public.community_photos(owner_id uuid primary key references public.profiles(id),visible boolean not null default true,version uuid not null default gen_random_uuid());
alter table public.community_photos enable row level security;
revoke all on public.community_photos from public,anon,authenticated;
grant select on public.community_photos to authenticated;
create policy photos_member_read on public.community_photos for select to authenticated using(public.community_verified() and (visible or owner_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-avatars','community-avatars',false,1048576,array['image/png']);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='community-avatars' and public.community_verified() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.community_photos where owner_id::text=(storage.foldername(name))[1] and visible)));
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='community-avatars' and public.community_verified() and name=auth.uid()::text||'/avatar.png');
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='community-avatars' and public.community_verified() and name=auth.uid()::text||'/avatar.png') with check(bucket_id='community-avatars' and public.community_verified() and name=auth.uid()::text||'/avatar.png');
create function public.set_community_photo(p_visible boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.community_verified() then raise exception 'AUTH_REQUIRED';end if;
 if p_visible and not exists(select 1 from storage.objects where bucket_id='community-avatars' and name=auth.uid()::text||'/avatar.png' and (metadata->>'size')::bigint between 1 and 1048576 and metadata->>'mimetype'='image/png') then raise exception 'PHOTO_NOT_READY';end if;
 insert into public.community_photos(owner_id,visible) values(auth.uid(),p_visible) on conflict(owner_id) do update set visible=excluded.visible,version=gen_random_uuid();
end $$;
create table public.commons_posts(id uuid primary key,author_id uuid references public.profiles(id),title text not null check(length(title) between 3 and 100),body text not null check(length(body) between 8 and 4000),forum text not null check(length(forum) between 1 and 64),created_at timestamptz not null default now(),hidden boolean not null default false);
create table public.commons_comments(id uuid primary key,post_id uuid not null references public.commons_posts(id),author_id uuid not null references public.profiles(id),body text not null check(length(body) between 2 and 1500),created_at timestamptz not null default now(),hidden boolean not null default false);
create table public.commons_likes(post_id uuid not null references public.commons_posts(id),owner_id uuid not null references public.profiles(id),primary key(post_id,owner_id));
create table public.commons_reports(post_id uuid not null references public.commons_posts(id),owner_id uuid not null references public.profiles(id),reason text not null check(length(reason) between 5 and 1000),created_at timestamptz not null default now(),primary key(post_id,owner_id));
create index commons_posts_recent on public.commons_posts(created_at desc) where not hidden;
create index commons_comments_post on public.commons_comments(post_id,created_at) where not hidden;
alter table public.commons_posts enable row level security;
alter table public.commons_comments enable row level security;
alter table public.commons_likes enable row level security;
alter table public.commons_reports enable row level security;
revoke all on public.commons_posts,public.commons_comments,public.commons_likes,public.commons_reports from public,anon,authenticated;
-- Only checked RPCs expose the feed and modify shared content. No direct client writes.
create function public.commons_publish(p_id uuid,p_title text,p_body text,p_forum text) returns void language plpgsql security definer set search_path='' as $$
declare prior public.commons_posts;
begin
 if not public.community_paid() then raise exception 'PAID_SUBSCRIPTION_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||'/commons/post',0));
 select * into prior from public.commons_posts where id=p_id;
 if prior.id is not null then if prior.author_id=auth.uid() and prior.title=p_title and prior.body=p_body and prior.forum=p_forum then return;else raise exception 'COMMUNITY_CONFLICT';end if;end if;
 if (select count(*) from public.commons_posts where author_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'COMMUNITY_LIMIT';end if;
 insert into public.commons_posts(id,author_id,title,body,forum) values(p_id,auth.uid(),trim(p_title),trim(p_body),p_forum);
end $$;
create function public.commons_comment(p_id uuid,p_post uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare prior public.commons_comments;
begin
 if not public.community_paid() then raise exception 'PAID_SUBSCRIPTION_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||'/commons/comment',0));
 select * into prior from public.commons_comments where id=p_id;
 if prior.id is not null then if prior.author_id=auth.uid() and prior.post_id=p_post and prior.body=p_body then return;else raise exception 'COMMUNITY_CONFLICT';end if;end if;
 if not exists(select 1 from public.commons_posts where id=p_post and not hidden) then raise exception 'POST_NOT_AVAILABLE';end if;
 if (select count(*) from public.commons_comments where author_id=auth.uid() and created_at>now()-interval '1 day')>=30 then raise exception 'COMMUNITY_LIMIT';end if;
 insert into public.commons_comments(id,post_id,author_id,body) values(p_id,p_post,auth.uid(),trim(p_body));
end $$;
create function public.commons_react(p_post uuid,p_liked boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.community_paid() then raise exception 'PAID_SUBSCRIPTION_REQUIRED';end if;
 if not exists(select 1 from public.commons_posts where id=p_post and not hidden) then raise exception 'POST_NOT_AVAILABLE';end if;
 if p_liked then insert into public.commons_likes values(p_post,auth.uid()) on conflict do nothing;
 else delete from public.commons_likes where post_id=p_post and owner_id=auth.uid();end if;
end $$;
create function public.commons_hide(p_id uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare admin boolean;
begin
 if not public.community_verified() then raise exception 'AUTH_REQUIRED';end if;
 select role='owner' into admin from public.profiles where id=auth.uid();
 if p_kind='post' then update public.commons_posts set hidden=true where id=p_id and (author_id=auth.uid() or admin);
 elsif p_kind='comment' then update public.commons_comments set hidden=true where id=p_id and (author_id=auth.uid() or admin);
 else raise exception 'INVALID_COMMUNITY_ACTION';end if;
 if not found then raise exception 'POST_NOT_AVAILABLE';end if;
end $$;
create function public.commons_report(p_post uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.community_paid() then raise exception 'PAID_SUBSCRIPTION_REQUIRED';end if;
 if not exists(select 1 from public.commons_posts where id=p_post and not hidden) then raise exception 'POST_NOT_AVAILABLE';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||'/commons/report',0));
 if (select count(*) from public.commons_reports where owner_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'COMMUNITY_LIMIT';end if;
 insert into public.commons_reports(post_id,owner_id,reason) values(p_post,auth.uid(),trim(p_reason)) on conflict(post_id,owner_id) do update set reason=excluded.reason;
end $$;
create function public.commons_author(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_id is null then jsonb_build_object('id',null,'name','Fieldwork by Baker','country','NONE','official',true) else
 (select jsonb_build_object('id',p.id,'name',p.display_name,'country',case when c.show_country then c.country else 'NONE' end,'official',p.role='owner') from public.profiles p left join public.community_profiles c on c.owner_id=p.id where p.id=p_id) end;
$$;
create function public.commons_feed(p_before timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.community_paid() then raise exception 'PAID_SUBSCRIPTION_REQUIRED';end if;
 select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into result from (
 select p.created_at,jsonb_build_object('id',p.id,'title',p.title,'body',p.body,'forum',p.forum,'createdAt',p.created_at,'author',public.commons_author(p.author_id),'canHide',p.author_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='owner'),
 'likes',(select count(*) from public.commons_likes l where l.post_id=p.id),'liked',exists(select 1 from public.commons_likes l where l.post_id=p.id and l.owner_id=auth.uid()),
 'reports',case when exists(select 1 from public.profiles where id=auth.uid() and role='owner') then coalesce((select jsonb_agg(jsonb_build_object('reason',r.reason,'createdAt',r.created_at)) from public.commons_reports r where r.post_id=p.id),'[]'::jsonb) else '[]'::jsonb end,
 'replyCount',(select count(*) from public.commons_comments c where c.post_id=p.id and not c.hidden),
 'comments',coalesce((select jsonb_agg(comment order by created_at) from (select c.created_at,jsonb_build_object('id',c.id,'body',c.body,'createdAt',c.created_at,'author',public.commons_author(c.author_id),'canHide',c.author_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role='owner')) as comment from public.commons_comments c where c.post_id=p.id and not c.hidden order by c.created_at desc limit 50) r),'[]'::jsonb)) as item
 from public.commons_posts p where not p.hidden and (p_before is null or p.created_at<p_before) order by p.created_at desc limit 30
 ) feed;
 return result;
end $$;
-- Genuine platform-authored starting points. No invented user accounts, likes, or comments.
insert into public.commons_posts(id,title,body,forum) values
 ('10000000-0000-4000-8000-000000000001','What makes a monthly supervisor review easier?','Welcome to Baker Commons. Share a de-identified workflow tip for organizing your hours and preparing useful supervision questions. Keep private client and workplace details out of your post.','Fieldwork & supervision'),
 ('10000000-0000-4000-8000-000000000002','Share a small win from your week','Progress can be a steadier study routine, clearer documentation, or a helpful supervision conversation. What is one small improvement you want to celebrate?','Wins & milestones'),
 ('10000000-0000-4000-8000-000000000003','Which study habit has helped you most?','Start a conversation about a practical study habit that you can sustain. Share how you review your reasoning and notice concepts that need another look. Do not post secure exam content.','Study strategies'),
 ('10000000-0000-4000-8000-000000000004','Facts first in ethics discussions','When discussing a de-identified situation, what facts would you need before deciding? Separate observations, assumptions, and missing information. No identifiable client scenarios.','Ethics discussions'),
 ('10000000-0000-4000-8000-000000000005','Introduce your learning goals','Tell the community what you hope to learn and the kind of accountability that would help. Share only details you are comfortable showing to other members.','Starting the BCBA journey'),
 ('10000000-0000-4000-8000-000000000006','A resource worth discussing','Share a public resource and what question it helped you think through. Explain why it was useful and where you would still seek clarification. Respect copyright and confidentiality.','Research & resources');
revoke all on function public.commons_author(uuid) from public,anon,authenticated;
revoke all on function public.community_verified(),public.community_paid(),public.set_community_photo(boolean),public.commons_publish(uuid,text,text,text),public.commons_comment(uuid,uuid,text),public.commons_react(uuid,boolean),public.commons_hide(uuid,text),public.commons_report(uuid,text),public.commons_feed(timestamptz) from public,anon;
grant execute on function public.community_verified(),public.community_paid(),public.set_community_photo(boolean),public.commons_publish(uuid,text,text,text),public.commons_comment(uuid,uuid,text),public.commons_react(uuid,boolean),public.commons_hide(uuid,text),public.commons_report(uuid,text),public.commons_feed(timestamptz) to authenticated;
commit;
