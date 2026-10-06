begin;
alter table public.source_documents add column mime text not null default 'application/octet-stream';
alter table public.source_documents add column kind text not null default 'supporting-document' check(kind in ('detailed-source','supporting-document'));
create table public.upload_intents (
 owner_id uuid not null references public.profiles(id), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null, primary key(owner_id,sha256)
);
alter table public.upload_intents enable row level security;
revoke all on public.upload_intents from anon,authenticated;
grant select on public.upload_intents to authenticated;
create policy intent_self on public.upload_intents for select to authenticated using(owner_id=(select auth.uid()));
-- Reserve the maximum object size, including uploads whose completion is unknown.
create function public.prepare_original(p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); total_bytes bigint; own_bytes bigint;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'AUTH_REQUIRED'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_HASH'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61006003);
 if exists(select 1 from public.source_documents where owner_id=actor and sha256=p_hash) then return false; end if;
 if exists(select 1 from storage.objects where bucket_id='fieldwork-originals' and name=actor::text||'/'||p_hash) then return false; end if;
 if exists(select 1 from public.upload_intents where owner_id=actor and sha256=p_hash and expires_at>now()) then return true; end if;
 select coalesce(sum(greatest(coalesce((metadata->>'size')::bigint,26214400),1)),0) into total_bytes from storage.objects where bucket_id='fieldwork-originals';
 select coalesce(sum(greatest(coalesce((metadata->>'size')::bigint,26214400),1)),0) into own_bytes from storage.objects where bucket_id='fieldwork-originals' and (storage.foldername(name))[1]=actor::text;
 select total_bytes+count(*)*26214400 into total_bytes from public.upload_intents i where expires_at>now() and not exists(select 1 from storage.objects o where o.bucket_id='fieldwork-originals' and o.name=i.owner_id::text||'/'||i.sha256);
 select own_bytes+count(*)*26214400 into own_bytes from public.upload_intents i where owner_id=actor and expires_at>now() and not exists(select 1 from storage.objects o where o.bucket_id='fieldwork-originals' and o.name=i.owner_id::text||'/'||i.sha256);
 if total_bytes+26214400>786432000 or own_bytes+26214400>157286400 then raise exception 'STORAGE_LIMIT'; end if;
 insert into public.upload_intents values(actor,p_hash,now()+interval '30 minutes') on conflict(owner_id,sha256) do update set expires_at=excluded.expires_at;
 return true;
end $$;
drop policy original_insert on storage.objects;
create policy original_insert on storage.objects for insert to authenticated with check (
 bucket_id='fieldwork-originals' and name=(select auth.uid())::text||'/'||split_part(name,'/',2)
 and split_part(name,'/',2) ~ '^[a-f0-9]{64}$'
 and exists(select 1 from public.upload_intents i where i.owner_id=(select auth.uid()) and i.sha256=split_part(name,'/',2) and i.expires_at>now())
);
create function public.record_original(p_hash text,p_filename text,p_bytes bigint,p_mime text,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); stored_size bigint;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'AUTH_REQUIRED'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_filename is null or length(p_filename) not between 1 and 255
 or p_bytes is null or p_bytes not between 1 and 26214400 or p_kind not in ('detailed-source','supporting-document')
 or p_mime is null or length(p_mime)>100 then raise exception 'INVALID_DOCUMENT'; end if;
 select (metadata->>'size')::bigint into stored_size from storage.objects where bucket_id='fieldwork-originals' and name=actor::text||'/'||p_hash;
 if stored_size is null or stored_size<>p_bytes then raise exception 'ORIGINAL_NOT_VERIFIED'; end if;
 insert into public.source_documents(owner_id,sha256,object_path,original_filename,bytes,mime,kind)
 values(actor,p_hash,actor::text||'/'||p_hash,p_filename,p_bytes,p_mime,p_kind) on conflict(owner_id,sha256) do nothing;
 delete from public.upload_intents where owner_id=actor and sha256=p_hash;
end $$;
create table public.import_journals (
 owner_id uuid not null references public.profiles(id), batch_id text not null check(length(batch_id) between 1 and 300),
 state text not null check(state in ('prepared','committed','failed')), payload jsonb not null,
 created_at timestamptz not null default now(), primary key(owner_id,batch_id,state)
);
alter table public.import_journals enable row level security;
revoke all on public.import_journals from anon,authenticated;
grant select on public.import_journals to authenticated;
create policy journal_self on public.import_journals for select to authenticated using(owner_id=(select auth.uid()));
create function public.record_import(p_batch jsonb) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v_batch_id text:=p_batch->>'id'; batch_state text:=p_batch->>'state'; prior jsonb;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'AUTH_REQUIRED'; end if;
 if p_batch is null or jsonb_typeof(p_batch)<>'object' or octet_length(p_batch::text)>2097152 or v_batch_id is null or length(v_batch_id) not between 1 and 300 or batch_state is null or batch_state not in ('prepared','committed','failed') then raise exception 'INVALID_IMPORT'; end if;
 if not exists(select 1 from public.source_documents where owner_id=actor and sha256=p_batch->>'sourceHash') then raise exception 'ORIGINAL_NOT_VERIFIED'; end if;
 if batch_state<>'prepared' and not exists(select 1 from public.import_journals where owner_id=actor and batch_id=v_batch_id and state='prepared') then raise exception 'IMPORT_NOT_PREPARED'; end if;
 select payload into prior from public.import_journals where owner_id=actor and import_journals.batch_id=v_batch_id and state=batch_state;
 if prior is not null and prior<>p_batch then raise exception 'VERSION_CONFLICT'; end if;
 insert into public.import_journals(owner_id,batch_id,state,payload) values(actor,v_batch_id,batch_state,p_batch) on conflict do nothing;
end $$;
revoke all on function public.prepare_original(text),public.record_original(text,text,bigint,text,text),public.record_import(jsonb) from public,anon;
grant execute on function public.prepare_original(text),public.record_original(text,text,bigint,text,text),public.record_import(jsonb) to authenticated;
commit;
