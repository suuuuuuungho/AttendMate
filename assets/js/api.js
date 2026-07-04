import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js?v=20260704h";
import {
  mockGetMember,
  mockSearchMembers,
  mockGetAllMembers,
  mockGetSeats,
  mockCheckin,
  mockMoveSeat,
  mockCancelCheckin,
} from "./mock.js?v=20260704h";

const USE_MOCK = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const headers = (extra = {}) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  ...extra,
});

// PostgREST는 기본적으로 PATCH/DELETE 성공 시 204(빈 응답)만 반환한다.
// 실제로 몇 행이 바뀌었는지 확인하려면 이 헤더로 변경된 행을 응답 본문에 포함시켜야 한다.
const returnRepresentation = () => headers({ Prefer: "return=representation" });

function toMember(row) {
  return { 회원ID: String(row.ID), 이름: row.Name, 학년반: row.Division };
}

// PostgREST는 명시적으로 페이지를 나누지 않으면 기본 1000행에서 잘라버린다.
// 회원(Member) 명단이 1000명을 넘으면 뒤쪽 학생/교사가 통째로 누락되므로
// (실제로 1487명이라 487명이 잘렸었다), 다 받을 때까지 반복 조회한다.
const PAGE_SIZE = 1000;
async function fetchAllRows(path) {
  let all = [];
  let offset = 0;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${SUPABASE_URL}${path}${sep}limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: headers(),
    });
    const page = await res.json();
    if (!Array.isArray(page) || !page.length) break;
    all = all.concat(page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function apiGet(action, params = {}) {
  if (USE_MOCK) return mockGet(action, params);
  if (action === "getMember") return getMember(params.id);
  if (action === "searchMembers") return searchMembers(params.q);
  if (action === "getAllMembers") return getAllMembers();
  if (action === "getSeats") return getSeats(params.time);
  if (action === "getActiveTimes") return getActiveTimes();
  return { error: "알 수 없는 action: " + action };
}

/**
 * AttendMate_Admin의 Control Panel이 관리하는 타임 활성화 상태.
 * TimeControl 테이블이 아직 없거나 조회에 실패하면 null을 반환해 "제어 없음"으로
 * 취급한다 (기존처럼 모든 타임을 그대로 노출) — 관리 기능이 없어도 앱이 깨지면 안 된다.
 */
async function getActiveTimes() {
  if (USE_MOCK) return { activeTimes: null };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/TimeControl?select=Time,Active`, { headers: headers() });
    if (!res.ok) return { activeTimes: null };
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return { activeTimes: null };
    return { activeTimes: data.filter((r) => r.Active).map((r) => r.Time) };
  } catch (e) {
    return { activeTimes: null };
  }
}

export async function apiPost(action, body) {
  if (USE_MOCK) return mockPost(action, body);
  if (action === "checkin") return checkin(body);
  if (action === "moveSeat") return moveSeat(body);
  if (action === "cancelCheckin") return cancelCheckin(body);
  return { error: "알 수 없는 action: " + action };
}

/**
 * Log 테이블 변경(체크인/이동/취소)을 실시간으로 구독한다. 다른 사용자의 변경이
 * 즉시 반영되도록 seats.js가 이 콜백에서 좌석 목록을 다시 불러온다.
 * 구독 해제 함수를 반환한다.
 * (폴링으로 대체 — seats.js의 setInterval(loadSeats, 15000)이 대신함)
 */
export function subscribeToSeatChanges(onChange) {
  return () => {};
}

function mockGet(action, params) {
  if (action === "getMember") return mockGetMember(params.id);
  if (action === "searchMembers") return mockSearchMembers(params.q);
  if (action === "getAllMembers") return mockGetAllMembers();
  if (action === "getSeats") return mockGetSeats(params.time);
  return { error: "알 수 없는 action: " + action };
}

function mockPost(action, body) {
  if (action === "checkin") return mockCheckin(body);
  if (action === "moveSeat") return mockMoveSeat(body);
  if (action === "cancelCheckin") return mockCancelCheckin(body);
  return { error: "알 수 없는 action: " + action };
}

async function getMember(id) {
  if (!id || Number.isNaN(Number(id))) return { found: false };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Member?ID=eq.${Number(id)}&select=ID,Name,Division`, {
      headers: headers(),
    });
    const data = await res.json();
    if (!data || !data.length) return { found: false };
    return { found: true, ...toMember(data[0]) };
  } catch (e) {
    return { found: false };
  }
}

async function searchMembers(q) {
  if (!q) return { results: [] };
  try {
    let orFilter = `Name.ilike.*${q}*,Division.ilike.*${q}*`;
    if (!Number.isNaN(Number(q))) orFilter += `,ID.eq.${Number(q)}`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Member?or=(${encodeURIComponent(orFilter)})&select=ID,Name,Division&limit=20`,
      { headers: headers() }
    );
    const data = await res.json();
    return { results: (data || []).map(toMember) };
  } catch (e) {
    return { results: [] };
  }
}

async function getAllMembers() {
  try {
    const data = await fetchAllRows(`/rest/v1/Member?select=ID,Name,Division&order=Division.asc,Name.asc`);
    return { members: data.map(toMember) };
  } catch (e) {
    return { members: [] };
  }
}

async function getSeats(time) {
  if (!time) return { seats: {} };
  try {
    const data = await fetchAllRows(
      `/rest/v1/Log?select=ID,Name,Division,Seat,Time&Time=eq.${encodeURIComponent(time)}`
    );
    const seats = {};
    for (const row of data) {
      seats[row.Seat] = toMember(row);
    }
    return { seats };
  } catch (e) {
    return { seats: {} };
  }
}

async function checkin(body) {
  const memberId = body.회원ID;
  const name = body.이름;
  const cls = body.학년반;
  const seat = body.좌석;
  const time = body.타임;
  if (!memberId || !seat || !time) {
    return { success: false, error: "필수 값이 없습니다 (회원ID/좌석/타임)" };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Log`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        "ID": Number(memberId),
        "Name": name,
        "Division": cls,
        "Seat": seat,
        "Time": time,
        "Timestamp": new Date().toISOString(),
      }),
    });

    if (res.status === 201) return { success: true };

    if (res.status === 409) {
      const existing = await fetch(
        `${SUPABASE_URL}/rest/v1/Log?select=Seat&ID=eq.${Number(memberId)}&Time=eq.${encodeURIComponent(time)}`,
        { headers: headers() }
      ).then(r => r.json());
      if (existing && existing.length) return { success: false, error: `이미 체크인되었습니다 (좌석 ${existing[0].Seat})` };
      return { success: false, error: "이미 배정된 좌석입니다: " + seat };
    }
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data.message || "체크인에 실패했습니다" };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

async function moveSeat(body) {
  const memberId = body.회원ID;
  const time = body.타임;
  const newSeat = body.좌석;
  if (!memberId || !time || !newSeat) {
    return { success: false, error: "필수 값이 없습니다 (회원ID/타임/좌석)" };
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Log?select=*&ID=eq.${Number(memberId)}&Time=eq.${encodeURIComponent(time)}`,
      {
        method: "PATCH",
        headers: returnRepresentation(),
        body: JSON.stringify({
          "Seat": newSeat,
          "Timestamp": new Date().toISOString(),
        }),
      }
    );

    if (res.status === 409) return { success: false, error: "이미 배정된 좌석입니다: " + newSeat };
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "자리 이동에 실패했습니다" };
    }

    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "체크인 기록을 찾을 수 없습니다" };
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

async function cancelCheckin(body) {
  const memberId = body.회원ID;
  const time = body.타임;
  if (!memberId || !time) {
    return { success: false, error: "필수 값이 없습니다 (회원ID/타임)" };
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Log?select=*&ID=eq.${Number(memberId)}&Time=eq.${encodeURIComponent(time)}`,
      {
        method: "DELETE",
        headers: returnRepresentation(),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "체크인 취소에 실패했습니다" };
    }

    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "체크인 기록을 찾을 수 없습니다" };
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}
