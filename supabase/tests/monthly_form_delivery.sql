begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','monthly-form-test@example.invalid',now(),'{"name":"Fictional Form Test"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}',true);
do $$ begin
 begin
  perform public.reserve_monthly_form_email('dddddddd-dddd-4ddd-8ddd-dddddddddddd',repeat('d',64));
  raise exception 'TEST_FAILED: trial sent paid form';
 exception when others then if sqlerrm<>'PAID_SUBSCRIPTION_REQUIRED' then raise; end if; end;
 if has_table_privilege('authenticated','public.monthly_form_deliveries','select') or has_table_privilege('authenticated','public.monthly_form_deliveries','insert') then raise exception 'TEST_FAILED: direct delivery access'; end if;
end $$;
reset role;
update public.profiles set subscription_tier='individual',subscription_status='active' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
do $$ declare n integer; request_id uuid; begin
 perform public.reserve_monthly_form_email('dddddddd-dddd-4ddd-8ddd-dddddddddddd',repeat('d',64));
 perform public.reserve_monthly_form_email('dddddddd-dddd-4ddd-8ddd-dddddddddddd',repeat('d',64));
 begin
  perform public.reserve_monthly_form_email('dddddddd-dddd-4ddd-8ddd-dddddddddddd',repeat('e',64));
  raise exception 'TEST_FAILED: changed payload reused email request';
 exception when others then if sqlerrm<>'EMAIL_REQUEST_CONFLICT' then raise; end if; end;
 for n in 1..9 loop
  request_id:=gen_random_uuid(); perform public.reserve_monthly_form_email(request_id,repeat('d',64));
 end loop;
 begin
  perform public.reserve_monthly_form_email(gen_random_uuid(),repeat('d',64));
  raise exception 'TEST_FAILED: quota bypass';
 exception when others then if sqlerrm<>'FORM_EMAIL_LIMIT' then raise; end if; end;
end $$;
rollback;
select 'PASS: trials denied, delivery table private, identical retries counted once, changed requests refused, ten-per-day limit' as verification;
