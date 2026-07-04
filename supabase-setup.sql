-- AttendMate: Supabase 전환을 위해 SQL Editor에서 한 번 실행할 스크립트.
-- 1) Log의 PK를 ID -> 자동증가 log_id로 교체하고 (ID, Time), (Time, Seat) 유일성 제약 추가
--    (기존 PK 제약 이름이 무엇이든 상관없이 안전하게 찾아서 제거한다)
do $$
declare
  pk_name text;
begin
  select tc.constraint_name into pk_name
  from information_schema.table_constraints tc
  where tc.table_schema = 'public' and tc.table_name = 'Log' and tc.constraint_type = 'PRIMARY KEY';
  if pk_name is not null then
    execute format('alter table public."Log" drop constraint %I', pk_name);
  end if;
end $$;

alter table public."Log" add column if not exists log_id bigint generated always as identity;
alter table public."Log" add constraint log_pkey primary key (log_id);
alter table public."Log" add constraint log_id_time_unique unique ("ID", "Time");
alter table public."Log" add constraint log_time_seat_unique unique ("Time", "Seat");

-- 2) RLS 비활성화 — 로그인 없는 공개 페이지이므로 anon(publishable) key로 자유롭게 읽기/쓰기 허용
alter table public."Member" disable row level security;
alter table public."Log" disable row level security;

-- 3) Log 테이블 변경사항을 Realtime으로 브로드캐스트 (다른 사용자의 배정/이동/취소 즉시 반영)
alter publication supabase_realtime add table public."Log";
