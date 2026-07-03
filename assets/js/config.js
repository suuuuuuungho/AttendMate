// 배포 후 apps-script/SETUP.md 안내에 따라 실제 웹 앱 URL로 교체할 것.
// 빈 문자열인 동안은 api.js가 mock.js의 목업 데이터로 자동 전환된다.
export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyu0GAye89rdHLsCXnfAsz4LgMM9XzLj05smSzisDMg0q82bLn7xTZVGhHPMALADfxQ/exec";

// 타임 타이틀은 언제든지 바뀔 수 있음 — 이 배열만 수정하면 드롭다운과 백엔드 저장값에
// 모두 반영된다 (타임 값 자체가 Sheet의 "타임" 열에 그대로 기록되는 키이기도 함).
export const TIMES = [
  "7/27(월) 저녁",
  "7/28(화) 오전",
  "7/28(화) 저녁",
  "7/29(수) 오전",
  "7/29(수) 저녁",
  "7/30(목) 오전",
];
