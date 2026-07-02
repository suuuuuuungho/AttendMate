import { APPS_SCRIPT_URL } from "./config.js";
import { mockGetMember, mockSearchMembers, mockGetAllMembers, mockGetSeats, mockCheckin } from "./mock.js";

const USE_MOCK = !APPS_SCRIPT_URL;

export async function apiGet(action, params = {}) {
  if (USE_MOCK) return mockGet(action, params);

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  return res.json();
}

export async function apiPost(action, body) {
  if (USE_MOCK) return mockPost(action, body);

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", action);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // preflight 회피
    body: JSON.stringify(body),
  });
  return res.json();
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
  return { error: "알 수 없는 action: " + action };
}
