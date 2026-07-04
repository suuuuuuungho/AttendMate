import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import {
  mockGetMember,
  mockSearchMembers,
  mockGetAllMembers,
  mockGetSeats,
  mockCheckin,
  mockMoveSeat,
  mockCancelCheckin,
} from "./mock.js";

const USE_MOCK = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const supabase = USE_MOCK ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function toMember(row) {
  return { 회원ID: String(row.ID), 이름: row.Name, 학년반: row.Division };
}

export async function apiGet(action, params = {}) {
  if (USE_MOCK) return mockGet(action, params);
  if (action === "getMember") return getMember(params.id);
  if (action === "searchMembers") return searchMembers(params.q);
  if (action === "getAllMembers") return getAllMembers();
  if (action === "getSeats") return getSeats(params.time);
  return { error: "알 수 없는 action: " + action };
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
 */
export function subscribeToSeatChanges(onChange) {
  if (USE_MOCK) return () => {};
  const channel = supabase
    .channel("log-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "Log" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
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
  const { data, error } = await supabase.from("Member").select("ID,Name,Division").eq("ID", Number(id)).maybeSingle();
  if (error || !data) return { found: false };
  return { found: true, ...toMember(data) };
}

async function searchMembers(q) {
  if (!q) return { results: [] };
  const orParts = [`Name.ilike.%${q}%`, `Division.ilike.%${q}%`];
  if (!Number.isNaN(Number(q))) orParts.push(`ID.eq.${Number(q)}`);
  const { data, error } = await supabase.from("Member").select("ID,Name,Division").or(orParts.join(",")).limit(20);
  if (error) return { results: [] };
  return { results: (data || []).map(toMember) };
}

async function getAllMembers() {
  const { data, error } = await supabase.from("Member").select("ID,Name,Division");
  if (error) return { members: [] };
  return { members: (data || []).map(toMember) };
}

async function getSeats(time) {
  if (!time) return { seats: {} };
  const { data, error } = await supabase.from("Log").select("ID,Name,Division,Seat,Time").eq("Time", time);
  if (error) return { seats: {} };
  const seats = {};
  for (const row of data || []) {
    seats[row.Seat] = toMember(row);
  }
  return { seats };
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

  const { error } = await supabase.from("Log").insert({
    "ID": Number(memberId),
    "Name": name,
    "Division": cls,
    "Seat": seat,
    "Time": time,
    "Timestamp": new Date().toISOString(),
  });

  if (!error) return { success: true };
  if (error.code === "23505") {
    const { data: existing } = await supabase
      .from("Log")
      .select("Seat")
      .eq("Time", time)
      .eq("ID", Number(memberId))
      .maybeSingle();
    if (existing) return { success: false, error: `이미 체크인되었습니다 (좌석 ${existing.Seat})` };
    return { success: false, error: "이미 배정된 좌석입니다: " + seat };
  }
  return { success: false, error: error.message };
}

async function moveSeat(body) {
  const memberId = body.회원ID;
  const time = body.타임;
  const newSeat = body.좌석;
  if (!memberId || !time || !newSeat) {
    return { success: false, error: "필수 값이 없습니다 (회원ID/타임/좌석)" };
  }

  const { data, error } = await supabase
    .from("Log")
    .update({ "Seat": newSeat, "Timestamp": new Date().toISOString() })
    .eq("ID", Number(memberId))
    .eq("Time", time)
    .select();

  if (error) {
    if (error.code === "23505") return { success: false, error: "이미 배정된 좌석입니다: " + newSeat };
    return { success: false, error: error.message };
  }
  if (!data || !data.length) return { success: false, error: "체크인 기록을 찾을 수 없습니다" };
  return { success: true };
}

async function cancelCheckin(body) {
  const memberId = body.회원ID;
  const time = body.타임;
  if (!memberId || !time) {
    return { success: false, error: "필수 값이 없습니다 (회원ID/타임)" };
  }

  const { data, error } = await supabase.from("Log").delete().eq("ID", Number(memberId)).eq("Time", time).select();

  if (error) return { success: false, error: error.message };
  if (!data || !data.length) return { success: false, error: "체크인 기록을 찾을 수 없습니다" };
  return { success: true };
}
