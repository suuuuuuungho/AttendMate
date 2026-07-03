// Apps Script 배포 전, 로컬 프리뷰에서 UI를 확인하기 위한 목업 데이터/동작.
// config.js의 APPS_SCRIPT_URL이 비어있을 때 api.js가 이 모듈을 대신 사용한다.

// 학년반 표기는 실제 시트 형식("중등부 N학년 x-y반" / "신입x반" / "장기섬김...")과
// 동일하게 맞춘다 — seat-map.js의 GRADE_GROUPS 정규식이 이 형식을 전제로 매칭한다.
const MOCK_MEMBERS = [
  { 회원ID: "M001", 이름: "김민준", 학년반: "중등부 1학년 1-1반" },
  { 회원ID: "M002", 이름: "이서연", 학년반: "중등부 1학년 1-1반" },
  { 회원ID: "M003", 이름: "박도윤", 학년반: "중등부 1학년 1-2반" },
  { 회원ID: "M004", 이름: "최지우", 학년반: "중등부 2학년 2-3반" },
  { 회원ID: "M005", 이름: "정하은", 학년반: "중등부 3학년 3-1반" },
  { 회원ID: "M006", 이름: "강서준", 학년반: "신입1반" },
  { 회원ID: "M007", 이름: "오유진", 학년반: "장기섬김" },
];

// time -> { seat: {회원ID, 이름, 학년반} }
const mockSeatLog = {
  "1부": {
    A3: { 회원ID: "M001", 이름: "김민준", 학년반: "중등부 1학년 1-1반" },
    A4: { 회원ID: "M002", 이름: "이서연", 학년반: "중등부 1학년 1-1반" },
    B12: { 회원ID: "M003", 이름: "박도윤", 학년반: "중등부 1학년 1-2반" },
    C20: { 회원ID: "M004", 이름: "최지우", 학년반: "중등부 2학년 2-3반" },
    D5: { 회원ID: "M005", 이름: "정하은", 학년반: "중등부 3학년 3-1반" },
    E10: { 회원ID: "M006", 이름: "강서준", 학년반: "신입1반" },
    F15: { 회원ID: "M007", 이름: "오유진", 학년반: "장기섬김" },
  },
};

export function mockGetMember(id) {
  const found = MOCK_MEMBERS.find((m) => m.회원ID === id);
  return found ? { found: true, ...found } : { found: false };
}

export function mockSearchMembers(q) {
  if (!q) return { results: [] };
  const query = q.toLowerCase();
  const results = MOCK_MEMBERS.filter(
    (m) =>
      m.회원ID.toLowerCase().includes(query) ||
      m.이름.toLowerCase().includes(query) ||
      m.학년반.toLowerCase().includes(query)
  ).slice(0, 20);
  return { results };
}

export function mockGetAllMembers() {
  return { members: MOCK_MEMBERS };
}

export function mockGetSeats(time) {
  return { seats: mockSeatLog[time] || {} };
}

export function mockCheckin({ 회원ID, 이름, 학년반, 좌석, 타임 }) {
  const seatsForTime = mockSeatLog[타임] || (mockSeatLog[타임] = {});
  if (seatsForTime[좌석]) {
    return { success: false, error: "이미 배정된 좌석입니다: " + 좌석 };
  }
  const already = Object.entries(seatsForTime).find(([, v]) => v.회원ID === 회원ID);
  if (already) {
    return { success: false, error: "이미 체크인되었습니다 (좌석 " + already[0] + ")" };
  }
  seatsForTime[좌석] = { 회원ID, 이름, 학년반 };
  return { success: true };
}

export function mockMoveSeat({ 회원ID, 타임, 좌석 }) {
  const seatsForTime = mockSeatLog[타임] || {};
  if (seatsForTime[좌석]) {
    return { success: false, error: "이미 배정된 좌석입니다: " + 좌석 };
  }
  const entry = Object.entries(seatsForTime).find(([, v]) => v.회원ID === 회원ID);
  if (!entry) return { success: false, error: "체크인 기록을 찾을 수 없습니다" };
  const [oldSeat, occupant] = entry;
  delete seatsForTime[oldSeat];
  seatsForTime[좌석] = occupant;
  return { success: true };
}

export function mockCancelCheckin({ 회원ID, 타임 }) {
  const seatsForTime = mockSeatLog[타임] || {};
  const entry = Object.entries(seatsForTime).find(([, v]) => v.회원ID === 회원ID);
  if (!entry) return { success: false, error: "체크인 기록을 찾을 수 없습니다" };
  delete seatsForTime[entry[0]];
  return { success: true };
}
