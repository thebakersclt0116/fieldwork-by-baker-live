-- Three fictional accounts. No real entry data or email is used; the test rolls back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('55555555-5555-4555-8555-555555555555','review-candidate@example.invalid',now(),'{"name":"Synthetic Candidate"}'),
('66666666-6666-4666-8666-666666666666','review-supervisor@example.invalid',now(),'{"name":"Synthetic Supervisor"}'),
('77777777-7777-4777-8777-777777777777','review-stranger@example.invalid',now(),'{"name":"Synthetic Stranger"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
select public.save_entries('[{"id":"synthetic-review-entry","date":"2026-10-06","duration":1,"notes":"Fictional test activity","status":"PENDING"}]',0,'[]');
select public.invite_review('synthetic-review-entry',0,'review-supervisor@example.invalid','Synthetic Supervisor',repeat('c',64));
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',true);
do $$ begin
 begin
  perform public.read_review(repeat('c',64));raise exception 'TEST_FAILED: wrong recipient read';
 exception when others then if sqlerrm<>'REVIEW_NOT_AVAILABLE' then raise; end if; end;
 if exists(select 1 from public.entries where id='synthetic-review-entry') then raise exception 'TEST_FAILED: direct recipient entry access'; end if;
end $$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',true);
do $$ declare view jsonb; first_result jsonb; repeated jsonb; begin
 view:=public.read_review(repeat('c',64));
 if view->'reviewEntry'->>'notes'<>'Fictional test activity' then raise exception 'TEST_FAILED: authoritative review'; end if;
 first_result:=public.accept_review(repeat('c',64),0,'VERIFIED','Synthetic review note','Synthetic message','88888888-8888-4888-8888-888888888888');
 repeated:=public.accept_review(repeat('c',64),0,'VERIFIED','Synthetic review note','Synthetic message','88888888-8888-4888-8888-888888888888');
 if first_result->>'approvalId' is distinct from repeated->>'approvalId' then raise exception 'TEST_FAILED: duplicate approval'; end if;
 begin
  perform public.accept_review(repeat('c',64),0,'REJECTED','Changed','','88888888-8888-4888-8888-888888888888');raise exception 'TEST_FAILED: approval overwritten';
 exception when others then if sqlerrm<>'REVIEW_ALREADY_SAVED' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.approvals where entry_id='synthetic-review-entry')<>1 then raise exception 'TEST_FAILED: immutable approval history'; end if;
 if (select payload->>'status' from public.entries where id='synthetic-review-entry')<>'VERIFIED' then raise exception 'TEST_FAILED: approval persistence'; end if;
 if (select version from public.workspaces)<>2 then raise exception 'TEST_FAILED: workspace version advanced'; end if;
 begin
  perform public.save_entries('[{"id":"synthetic-review-entry","date":"2026-10-06","duration":2,"notes":"Changed fictional activity","status":"VERIFIED"}]',2,'[]');raise exception 'TEST_FAILED: approved edit without reason';
 exception when others then if sqlerrm<>'APPROVED_EDIT_REASON_REQUIRED' then raise; end if; end;
 perform public.save_entries('[{"id":"synthetic-review-entry","date":"2026-10-06","duration":2,"notes":"Changed fictional activity","status":"VERIFIED","revisionReason":"Synthetic correction"}]',2,'[]');
 if (select payload->>'status' from public.entries where id='synthetic-review-entry')<>'PENDING' then raise exception 'TEST_FAILED: edited approval retained'; end if;
 if (select approved_payload->>'notes' from public.approvals where entry_id='synthetic-review-entry')<>'Fictional test activity' then raise exception 'TEST_FAILED: approved snapshot changed'; end if;
end $$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',true);
do $$ begin
 begin
  perform public.read_review(repeat('c',64));raise exception 'TEST_FAILED: revoked link read';
 exception when others then if sqlerrm<>'REVIEW_NOT_AVAILABLE' then raise; end if; end;
 begin
  perform public.accept_review(repeat('c',64),0,'VERIFIED','','','99999999-9999-4999-8999-999999999999');raise exception 'TEST_FAILED: stale approval';
 exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
end $$;
rollback;
select 'PASS: assigned verified recipient, immutable approval, duplicate delivery, changed-entry revocation' as verification;
