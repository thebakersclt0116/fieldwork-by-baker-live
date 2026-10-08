begin;
create function public.save_entries(p_entries jsonb,p_expected_version bigint,p_delete_ids jsonb default '[]')
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); workspace_version bigint; item jsonb; old public.entries%rowtype; v_entry_id text; next_revision bigint; reason text; actor_email text;
begin
 select email into actor_email from public.profiles where id=actor;
 if actor is null or actor_email is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception 'VERSION_CONFLICT'; end if;
 if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_typeof(p_delete_ids) is distinct from 'array' then raise exception 'INVALID_ENTRY'; end if;
 if jsonb_array_length(p_entries)>500 or jsonb_array_length(p_delete_ids)>500 or octet_length(p_entries::text)>2097152 or octet_length(p_delete_ids::text)>200000 then raise exception 'REQUEST_TOO_LARGE'; end if;
 if exists(select 1 from jsonb_array_elements(p_delete_ids) d where jsonb_typeof(d) is distinct from 'string' or length(d#>>'{}') not between 1 and 300) then raise exception 'INVALID_ENTRY'; end if;
 insert into public.workspaces(owner_id) values(actor) on conflict do nothing;
 select version into workspace_version from public.workspaces where owner_id=actor for update;
 if workspace_version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
 if exists(select 1 from jsonb_array_elements(p_entries) e group by e->>'id' having count(*)>1) then raise exception 'DUPLICATE_ENTRY_ID'; end if;
 for item in select value from jsonb_array_elements(p_entries) loop
  v_entry_id:=item->>'id';
  if jsonb_typeof(item)<>'object' or v_entry_id is null or length(v_entry_id) not between 1 and 300 then raise exception 'INVALID_ENTRY'; end if;
  if jsonb_typeof(item->'duration') is distinct from 'number' or jsonb_typeof(item->'date') is distinct from 'string' then raise exception 'INVALID_ENTRY'; end if;
  if (item->>'duration')::numeric<=0 or (item->>'duration')::numeric>24 or item->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'INVALID_ENTRY'; end if;
  perform (item->>'date')::date;
  select * into old from public.entries where owner_id=actor and id=v_entry_id for update;
  -- Clients cannot forge an approval, its history, or the authoritative revision counter.
  item:=item-'revisionHistory'-'lastApprovedAt'-'lastApprovalRevision';
  item:=jsonb_set(item,'{userId}',to_jsonb(actor_email));
  reason:=left(coalesce(item->>'revisionReason',''),2000);
  if old.id is null then
   if item->>'status'='VERIFIED' then
    -- Imported historical verification is source evidence, never a new Baker approval.
    item:=jsonb_set(item,'{status}','"PENDING"');
    item:=jsonb_set(item,'{historicalSourceStatus}','"VERIFIED"');
   end if;
   item:=jsonb_set(item,'{revision}','0');
   insert into public.entries(owner_id,id,payload) values(actor,v_entry_id,item);
  else
   if old.deleted_at is not null then raise exception 'DELETED_ENTRY_CONFLICT'; end if;
   if (item-'revision')=(old.payload-'revision'-'revisionHistory'-'lastApprovedAt'-'lastApprovalRevision') then continue; end if;
   if old.payload->>'status'='VERIFIED' and length(btrim(reason))<3 then raise exception 'APPROVED_EDIT_REASON_REQUIRED'; end if;
   next_revision:=old.revision+1;
   insert into public.entry_versions(owner_id,entry_id,revision,payload,reason)
   values(actor,v_entry_id,old.revision,old.payload,coalesce(nullif(reason,''),'Entry updated'));
   -- A user write may never grant VERIFIED, including when correcting an earlier rejection.
   if item->>'status'='VERIFIED' or old.payload->>'status'='VERIFIED' then item:=jsonb_set(item,'{status}','"PENDING"'); end if;
   if old.payload->>'status'='VERIFIED' then item:=jsonb_set(item,'{requiresReapproval}','true'); end if;
   item:=jsonb_set(item,'{revision}',to_jsonb(next_revision));
   update public.entries set payload=item,revision=next_revision,updated_at=now() where owner_id=actor and id=v_entry_id;
   update public.supervisor_invitations set revoked_at=now() where owner_id=actor and entry_id=old.id and revoked_at is null;
  end if;
 end loop;
 for v_entry_id in select jsonb_array_elements_text(p_delete_ids) loop
  select * into old from public.entries where owner_id=actor and id=v_entry_id and deleted_at is null for update;
  if old.id is null then continue; end if;
  insert into public.entry_versions(owner_id,entry_id,revision,payload,reason) values(actor,v_entry_id,old.revision,old.payload,'Entry removed by owner');
  update public.entries set deleted_at=now(),revision=revision+1,updated_at=now() where owner_id=actor and id=v_entry_id;
  update public.supervisor_invitations set revoked_at=now() where owner_id=actor and entry_id=old.id and revoked_at is null;
 end loop;
 update public.workspaces set version=version+1,updated_at=now() where owner_id=actor;
 return workspace_version+1;
end $$;
revoke all on function public.save_entries(jsonb,bigint,jsonb) from public,anon;
grant execute on function public.save_entries(jsonb,bigint,jsonb) to authenticated;
commit;
