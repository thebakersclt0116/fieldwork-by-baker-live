begin;
-- Preserve the existing server-only function and its permissions.
do $migration$
declare definition text;marker text:='insert into public.billing_events(mode,event_id) values(p_mode,p_event_id);';replacement text;
begin
 definition:=pg_get_functiondef('public.apply_billing_snapshot(uuid,text,text,text,text,text,bigint,boolean,bigint,text)'::regprocedure);
 if position('Completed subscriptions release their matching checkout claim' in definition)>0 then return;end if;
 if position(marker in definition)=0 then raise exception 'BILLING_FUNCTION_VERSION_MISMATCH';end if;
 replacement:=marker||E'\n -- Completed subscriptions release their matching checkout claim.\n if p_status in (''active'',''canceled'',''incomplete_expired'') then\n update public.billing_checkout_claims set expires_at=least(expires_at,now()) where owner_id=p_owner and mode=p_mode and plan=p_plan;\n end if;';
 execute replace(definition,marker,replacement);
end $migration$;
commit;
