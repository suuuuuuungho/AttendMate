-- Member 테이블에 Phone 컬럼 추가 후, 우선 임시값으로 전부 채워둔다 (추후 실제 번호로 업데이트 예정).
ALTER TABLE public."Member" ADD COLUMN IF NOT EXISTS "Phone" text;
UPDATE public."Member" SET "Phone" = '01025895573';

-- Member 테이블이 realtime publication에 포함돼 있는데 PK/REPLICA IDENTITY가 없어서
-- UPDATE가 막히는 경우 아래로 해결한다 (전체 행을 식별자로 사용).
ALTER TABLE public."Member" REPLICA IDENTITY FULL;
