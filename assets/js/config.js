// Supabase 프로젝트 접속 정보. 둘 중 하나라도 비어있으면 api.js가 mock.js의
// 목업 데이터로 자동 전환된다. anon(publishable) key는 브라우저에 노출되어도
// 안전하도록 설계된 키이므로 여기 하드코딩해도 된다 (RLS를 안 쓰는 대신
// 이 프로젝트는 로그인 없는 공개 페이지로 운영한다).
export const SUPABASE_URL = "https://hmczbuzziorgqwgyhati.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_IXVkIRdwEmrEW9Bshsb5dw_okT8thEw";

// 타임 타이틀은 언제든지 바뀔 수 있음 — 이 배열만 수정하면 드롭다운과 백엔드 저장값에
// 모두 반영된다 (타임 값 자체가 Sheet의 "타임" 열에 그대로 기록되는 키이기도 함).
export const TIMES = [
  ”7/19(주) 중등부예배"
  "7/27(월) 저녁",
  "7/28(화) 오전",
  "7/28(화) 저녁",
  "7/29(수) 오전",
  "7/29(수) 저녁",
  "7/30(목) 오전",
];
