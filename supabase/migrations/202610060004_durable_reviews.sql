begin;
alter table public.supervisor_invitations add column supervisor_name text not null default '';
alter table public.supervisor_invitations add column consumed_at timestamptz;
alter table public.approvals add column request_id uuid;
alter table public.approvals add column message text not null default '';
create unique index approval_once_per_invite on public.approvals(invitation_id);
create function public.invite_review(p_entry_id text,p_revision bigint,p_email text,p_name text,p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_entry public.entries%rowtype; invite_id uuid;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and (role in ('owner','professional') or trial_ends_at>now() or (subscription_tier='professional' and subscription_status in ('active','trialing')))) then raise exception 'SUPERVISOR_TOOLS_REQUIRED'; end if;
 if p_entry_id is null or p_revision is null or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_name is null or length(p_name) not between 1 and 120 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INVITATION'; end if;
 -- Use the same lock order as entry saving and review acceptance.
 perform 1 from public.workspaces where owner_id=actor for update;
 select * into current_entry from public.entries where owner_id=actor and id=p_entry_id and deleted_at is null for update;
 if current_entry.id is null or current_entry.revision<>p_revision then raise exception 'VERSION_CONFLICT'; end if;
 if (select count(*) from public.supervisor_invitations where owner_id=actor and created_at>now()-interval '1 day')>=30 then raise exception 'INVITATION_LIMIT'; end if;
 -- Reassigning review access invalidates the previous recipient's link.
 update public.supervisor_invitations set revoked_at=now() where owner_id=actor and entry_id=p_entry_id and revoked_at is null;
 insert into public.supervisor_invitations(owner_id,entry_id,entry_revision,supervisor_email,supervisor_name,token_sha256,expires_at)
 values(actor,p_entry_id,p_revision,lower(p_email),p_name,p_hash,now()+interval '14 days') returning id into invite_id;
 return invite_id;
end $$;
create function public.read_review(p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_email text; invitation public.supervisor_invitations%rowtype; current_entry public.entries%rowtype; owner_email text;
begin
 select lower(u.email) into actor_email from auth.users u join public.profiles p on p.id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null;
 if actor_email is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into invitation from public.supervisor_invitations where token_sha256=p_hash and supervisor_email=actor_email and revoked_at is null and expires_at>now();
 if invitation.id is null then raise exception 'REVIEW_NOT_AVAILABLE'; end if;
 select * into current_entry from public.entries where owner_id=invitation.owner_id and id=invitation.entry_id and deleted_at is null;
 if current_entry.id is null or current_entry.revision<>invitation.entry_revision then raise exception 'VERSION_CONFLICT'; end if;
 select email into owner_email from public.profiles where id=invitation.owner_id;
 return jsonb_build_object('supervisor',jsonb_build_object('name',invitation.supervisor_name,'email',invitation.supervisor_email),'superviseeEmail',owner_email,'reviewEntry',current_entry.payload||jsonb_build_object('revision',current_entry.revision,'narrative',current_entry.payload->>'notes'),'expiresAt',invitation.expires_at,'saved',invitation.consumed_at is not null);
end $$;
create function public.accept_review(p_hash text,p_revision bigint,p_status text,p_note text,p_message text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_email text; invitation public.supervisor_invitations%rowtype; current_entry public.entries%rowtype; prior public.approvals%rowtype; approval_id uuid; next_version bigint; approved jsonb;
begin
 select lower(u.email) into actor_email from auth.users u join public.profiles p on p.id=u.id where u.id=actor and u.email_confirmed_at is not null;
 if actor_email is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_status is null or p_status not in ('VERIFIED','PENDING','REJECTED') or p_note is null or p_message is null or length(p_note)>2000 or length(p_message)>2000 or p_request_id is null or p_revision is null then raise exception 'INVALID_REVIEW'; end if;
 select * into invitation from public.supervisor_invitations where token_sha256=p_hash and supervisor_email=actor_email;
 if invitation.id is null then raise exception 'REVIEW_NOT_AVAILABLE'; end if;
 perform 1 from public.workspaces where owner_id=invitation.owner_id for update;
 select * into current_entry from public.entries where owner_id=invitation.owner_id and id=invitation.entry_id for update;
 select i.* into invitation from public.supervisor_invitations i where i.id=invitation.id for update;
 if invitation.revoked_at is not null or invitation.expires_at<=now() or current_entry.deleted_at is not null or current_entry.id is null or invitation.entry_revision<>p_revision or current_entry.revision<>p_revision then raise exception 'VERSION_CONFLICT'; end if;
 select * into prior from public.approvals where invitation_id=invitation.id;
 if prior.id is not null then
  if prior.request_id=p_request_id and prior.status=p_status and prior.note=p_note and prior.message=p_message then return jsonb_build_object('saved',true,'approvalId',prior.id); end if;
  raise exception 'REVIEW_ALREADY_SAVED';
 end if;
 approved:=current_entry.payload;
 insert into public.approvals(invitation_id,owner_id,entry_id,entry_revision,supervisor_id,status,note,message,request_id,approved_payload)
 values(invitation.id,invitation.owner_id,invitation.entry_id,p_revision,actor,p_status,p_note,p_message,p_request_id,approved) returning id into approval_id;
 update public.entries set payload=payload||jsonb_build_object('status',p_status,'supervisorNote',p_note,'supervisorMessage',p_message,'supervisorEmail',actor_email,'requiresReapproval',false)||case when p_status='VERIFIED' then jsonb_build_object('lastApprovedAt',now(),'lastApprovalRevision',p_revision) else '{}'::jsonb end,updated_at=now() where owner_id=invitation.owner_id and id=invitation.entry_id;
 update public.supervisor_invitations set consumed_at=now() where id=invitation.id;
 update public.workspaces set version=version+1,updated_at=now() where owner_id=invitation.owner_id returning version into next_version;
 return jsonb_build_object('saved',true,'approvalId',approval_id,'workspaceVersion',next_version);
end $$;
create function public.revoke_review(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.supervisor_invitations set revoked_at=now() where id=p_id and owner_id=auth.uid() and revoked_at is null;
end $$;
revoke all on function public.invite_review(text,bigint,text,text,text),public.read_review(text),public.accept_review(text,bigint,text,text,text,uuid),public.revoke_review(uuid) from public,anon;
grant execute on function public.invite_review(text,bigint,text,text,text),public.read_review(text),public.accept_review(text,bigint,text,text,text,uuid),public.revoke_review(uuid) to authenticated;
commit;
