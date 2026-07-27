-- 출석 처리(체크인) 후 자리를 재배정할 때 문자가 한 번 더 나가던 문제 수정.
--
-- 원인: moveSeat(자리 이동/재배정)은 UPDATE라서 notify_attendance_sms 함수 자체는
-- INSERT/DELETE가 아니면 즉시 return하도록 이미 짜여 있지만(supabase-sms-control.sql),
-- 트리거 자체가 "AFTER INSERT OR DELETE"로 정확히 걸려 있어야 이 안전장치가 의미가
-- 있다. 트리거 정의가 예전에 다른 값으로 만들어졌을 가능성에 대비해, 여기서 트리거를
-- "INSERT/DELETE에만" 걸리도록 다시 명확히 만든다. SQL Editor에서 한 번만 실행.

DROP TRIGGER IF EXISTS trg_attendance_sms ON public."Log";
CREATE TRIGGER trg_attendance_sms
AFTER INSERT OR DELETE ON public."Log"
FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_sms();

-- notify_attendance_sms 함수도 다시 정의해서, UPDATE(자리 이동/재배정)는 트리거가
-- 혹시라도 걸리더라도 맨 앞에서 바로 걸러내도록 tg_op 분기를 더 명시적으로 만든다
-- (기존에도 else에서 걸러졌지만, UPDATE를 이름으로 콕 집어 의도를 분명히 한다).
CREATE OR REPLACE FUNCTION public.notify_attendance_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_member record;
  v_event text;
  v_time text;
  v_sms_enabled boolean;
begin
  if tg_op = 'UPDATE' then
    return coalesce(new, old);
  end if;

  select "Enabled" into v_sms_enabled from public."SmsControl" where "id" = 1;
  if v_sms_enabled is false then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_event := 'checkin';
    v_time := new."Time";
    select "Name", "Division", "ParentPhone" into v_member from public."Member" where "ID" = new."ID";
  elsif tg_op = 'DELETE' then
    v_event := 'cancel';
    v_time := old."Time";
    select "Name", "Division", "ParentPhone" into v_member from public."Member" where "ID" = old."ID";
  else
    return coalesce(new, old);
  end if;

  if v_member is null or v_member."ParentPhone" is null or v_member."ParentPhone" = '' then
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := 'https://hmczbuzziorgqwgyhati.supabase.co/functions/v1/send-attendance-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_IXVkIRdwEmrEW9Bshsb5dw_okT8thEw'
    ),
    body := jsonb_build_object(
      'event', v_event,
      'time', v_time,
      'name', v_member."Name",
      'division', v_member."Division",
      'parentPhone', v_member."ParentPhone"
    )
  );

  return coalesce(new, old);
end;
$$;
