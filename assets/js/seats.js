import { TIMES } from "./config.js?v=20260719b";
import { apiGet, apiPost, subscribeToSeatChanges } from "./api.js?v=20260719b";
import { renderSeatMap, abbreviateClass, GRADE_GROUPS, getGradeGroup } from "./seat-map.js?v=20260719b";
import { renderTimeTabs } from "./time-tabs.js?v=20260719b";
import { initAppSwitcher } from "./app-switcher.js?v=20260719b";

initAppSwitcher();

const timeTabsEl = document.getElementById("timeTabs");
const seatMapEl = document.getElementById("seatMap");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");
const gradeLegendEl = document.getElementById("gradeLegend");
const filterSelect = document.getElementById("filterSelect");

const assignModal = document.getElementById("assignModal");
const assignModalTitle = document.getElementById("assignModalTitle");
const assignSearchInput = document.getElementById("assignSearchInput");
const assignResults = document.getElementById("assignResults");
const assignCancelBtn = document.getElementById("assignCancelBtn");

const occupantModal = document.getElementById("occupantModal");
const occupantModalText = document.getElementById("occupantModalText");
const occupantCloseBtn = document.getElementById("occupantCloseBtn");
const occupantMoveBtn = document.getElementById("occupantMoveBtn");
const occupantCancelCheckinBtn = document.getElementById("occupantCancelCheckinBtn");

const moveBanner = document.getElementById("moveBanner");
const moveBannerText = document.getElementById("moveBannerText");
const moveCancelBtn = document.getElementById("moveCancelBtn");

const unassignedSectionEl = document.getElementById("unassignedSection");
const unassignedGroupsEl = document.getElementById("unassignedGroups");
// 통계 페이지의 "출석 수정"이 실제 좌석 없이 출석 처리할 때 쓰는 자리표식과 반드시 같은 값이어야 한다.
const UNASSIGNED_SEAT_PREFIX = "UNASSIGNED-";

const locateSearchInput = document.getElementById("locateSearchInput");
const locateResultsEl = document.getElementById("locateResults");

const MAX_SEARCH_RESULTS = 20;

let activeTimes = TIMES; // Control Panel이 관리하는 활성 타임 목록 — 로드 전까지는 전체를 그대로 노출
let currentTime = TIMES[0];
let currentSeats = {};
let pendingSeatId = null;
// 배정/이동/취소가 진행 중일 때 걸어두는 락. 이 동안 도착하는 폴링 응답은
// 아직 반영 안 된 서버 상태(구 데이터)를 담고 있을 수 있어 낙관적 업데이트를
// 덮어써버리므로 무시한다 — "이동했는데 잠시 후 원래 자리로 돌아옴" 버그의 원인.
let pendingMutationCount = 0;
let seatsRequestSeq = 0; // 탭 전환 등으로 폴링이 겹칠 때 오래된 응답을 무시하기 위한 순번
let allMembers = [];
let occupantContext = null; // 점유 좌석 모달이 어떤 좌석/학생을 보고 있는지
let moveSource = null; // 자리 이동 모드: { seatId, occupant } — null이면 평상시
let currentFilter = { type: "all" }; // {type:"all"} | {type:"grade", key} | {type:"class", value}

async function loadAllMembers() {
  const res = await apiGet("getAllMembers");
  allMembers = res.members || [];
}

const membersReady = loadAllMembers();

/** 좌석 배경색만 봐서는 어떤 색이 어떤 학년인지 알 수 없어서, 색상 범례를 한 번 그려둔다. */
function renderGradeLegend() {
  gradeLegendEl.innerHTML = "";
  for (const group of GRADE_GROUPS) {
    const item = document.createElement("span");
    item.className = "grade-legend__item";
    const swatch = document.createElement("span");
    swatch.className = "grade-legend__swatch";
    swatch.style.background = `var(${group.cssVar})`;
    const label = document.createElement("span");
    label.className = "grade-legend__label text-caption";
    label.textContent = group.label;
    item.append(swatch, label);
    gradeLegendEl.appendChild(item);
  }
}

function refreshTabs() {
  renderTimeTabs(timeTabsEl, activeTimes, currentTime, (time) => {
    currentTime = time;
    exitMoveMode(); // 다른 타임의 좌석으로 이동해버리는 사고 방지
    refreshTabs();
    loadSeats();
  });
}

/**
 * AttendMate_Admin의 Control Panel에서 비활성화한 타임은 드롭다운에서 아예 뺀다.
 * TimeControl 테이블이 없으면(res.activeTimes === null) 제어 없음으로 보고 전체를 노출한다.
 */
async function refreshActiveTimes() {
  const res = await apiGet("getActiveTimes");
  const next = res.activeTimes && res.activeTimes.length ? TIMES.filter((t) => res.activeTimes.includes(t)) : TIMES;
  const changed = next.join(",") !== activeTimes.join(",");
  activeTimes = next;
  if (!activeTimes.includes(currentTime)) {
    currentTime = activeTimes[0] || TIMES[0];
    exitMoveMode();
    refreshTabs();
    loadSeats();
  } else if (changed) {
    refreshTabs();
  }
}

/**
 * 좌석판 렌더링의 단일 진입점. renderSeatMap의 제자리 갱신(applySeatState)이
 * 좌석 클래스를 초기화하므로, 필터 하이라이트와 이동 모드 표시를 매번 다시 입힌다.
 */
function rerenderSeats() {
  renderSeatMap(seatMapEl, currentSeats, { selectable: true, onSeatClick: handleSeatClick });
  applyFilter();
  markMoveSource();
  renderUnassignedPanel();
}

/**
 * 통계 페이지의 "출석 수정"으로 실제 좌석 없이 출석 처리된 학생들 — currentSeats에는
 * 있지만 좌석판의 실제 좌석 버튼(A1~H90)에는 그려지지 않는 UNASSIGNED_SEAT_PREFIX
 * 항목들을 모아 학년별 블록으로 보여준다. 블록을 클릭하면 이동 모드로 들어가
 * 기존 "자리 이동" 흐름 그대로 빈 좌석을 골라 실제 좌석을 배정할 수 있다.
 */
function renderUnassignedPanel() {
  const entries = Object.entries(currentSeats).filter(([seatId]) => seatId.startsWith(UNASSIGNED_SEAT_PREFIX));
  unassignedGroupsEl.innerHTML = "";
  unassignedSectionEl.style.display = entries.length ? "block" : "none";
  if (!entries.length) return;

  const groups = [...GRADE_GROUPS, { key: "other", label: "기타", cssVar: null }];
  for (const group of groups) {
    const members = entries.filter(([, occ]) => (getGradeGroup(occ.학년반)?.key || "other") === group.key);
    if (!members.length) continue;

    const groupEl = document.createElement("div");
    groupEl.className = "unassigned-grade";
    if (group.cssVar) groupEl.style.setProperty("--grade-color", `var(${group.cssVar})`);

    const label = document.createElement("div");
    label.className = "unassigned-grade__label text-caption-strong";
    label.textContent = `${group.label} (${members.length}명)`;
    groupEl.appendChild(label);

    const chips = document.createElement("div");
    chips.className = "unassigned-grade__chips";
    for (const [seatId, occ] of members) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "unassigned-chip";
      if (moveSource && moveSource.seatId === seatId) chip.classList.add("unassigned-chip--move-source");
      chip.textContent = `${occ.이름} · ${abbreviateClass(occ.학년반)}`;
      chip.addEventListener("click", () => startAssignFromUnassigned(seatId, occ));
      chips.appendChild(chip);
    }
    groupEl.appendChild(chips);
    unassignedGroupsEl.appendChild(groupEl);
  }
}

function startAssignFromUnassigned(seatId, occupant) {
  if (moveSource && moveSource.seatId === seatId) return; // 이미 이 학생을 이동 중
  moveSource = { seatId, occupant };
  moveBannerText.textContent = `${occupant.이름}님이 배정될 빈 좌석을 선택하세요`;
  moveBanner.style.display = "flex";
  markMoveSource();
  renderUnassignedPanel();
}

/**
 * 배정/이동/취소는 네트워크 왕복 때문에 기다리는 동안
 * "아무 반응이 없다"는 인상을 준다. 그래서 화면은 낙관적으로 바로 갱신해 즉시
 * 반응하는 것처럼 보이게 하고, 이 토스트로 실제 처리 중/완료/실패 상태를 알려준다.
 * 실패하면 호출부에서 낙관적으로 바꿔둔 상태를 되돌린다.
 */
let activeToastEl = null;
function showProcessingToast(text) {
  if (activeToastEl) activeToastEl.remove();
  const el = document.createElement("div");
  el.className = "toast toast--processing";
  el.textContent = text;
  document.body.appendChild(el);
  activeToastEl = el;
  return {
    complete(msg) {
      el.className = "toast toast--success";
      el.textContent = msg;
      setTimeout(() => {
        if (activeToastEl === el) activeToastEl = null;
        el.remove();
      }, 1800);
    },
    fail(msg) {
      el.className = "toast toast--error";
      el.textContent = msg;
      setTimeout(() => {
        if (activeToastEl === el) activeToastEl = null;
        el.remove();
      }, 2500);
    },
  };
}

/** "PM 6:26" 형식 (AM/PM이 시각 앞에 옴) — Intl 로케일 포맷으로는 못 만들어서 직접 조립한다. */
function formatUpdatedTime(date) {
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${ampm} ${hours12}:${minutes}`;
}

async function loadSeats() {
  const seq = ++seatsRequestSeq;
  const requestedTime = currentTime;
  const res = await apiGet("getSeats", { time: requestedTime });
  if (seq !== seatsRequestSeq) return; // 더 최근 폴링(탭 전환 등)에 의해 대체됨
  if (requestedTime !== currentTime) return; // 응답 도착 전에 다른 타임으로 전환됨
  if (pendingMutationCount > 0) return; // 배정/이동/취소 진행 중 — 그 결과가 최종 상태를 반영한다
  currentSeats = res.seats || {};
  rerenderSeats();
  lastUpdatedEl.textContent = formatUpdatedTime(new Date()) + " Updated";
}

function handleSeatClick(seatId, occupant) {
  if (moveSource) {
    if (occupant) {
      if (occupant.회원ID !== moveSource.occupant.회원ID) {
        alert("이미 배정된 좌석입니다. 빈 좌석을 선택해주세요.");
      }
      return;
    }
    performMove(seatId);
    return;
  }
  if (occupant) {
    openOccupantModal(seatId, occupant);
  } else {
    openAssignModal(seatId);
  }
}

/* ===== 점유 좌석 액션 (자리 이동 / 체크인 취소) ===== */

function openOccupantModal(seatId, occupant) {
  occupantContext = { seatId, occupant };
  occupantModalText.textContent = `${seatId} — ${occupant.이름} · ${abbreviateClass(occupant.학년반)}`;
  occupantModal.style.display = "flex";
}

function closeOccupantModal() {
  occupantModal.style.display = "none";
  occupantContext = null;
}

function enterMoveMode() {
  if (!occupantContext) return;
  moveSource = occupantContext;
  closeOccupantModal();
  moveBannerText.textContent = `${moveSource.occupant.이름}님이 이동할 빈 좌석을 선택하세요`;
  moveBanner.style.display = "flex";
  markMoveSource();
  renderUnassignedPanel();
}

function exitMoveMode() {
  moveSource = null;
  moveBanner.style.display = "none";
  markMoveSource();
  renderUnassignedPanel();
}

/** 이동 모드일 때 원래 좌석에 파란 외곽선 표시 (재렌더링마다 다시 입혀야 함). */
function markMoveSource() {
  seatMapEl.querySelectorAll(".seat--move-source").forEach((el) => el.classList.remove("seat--move-source"));
  if (!moveSource) return;
  seatMapEl.querySelector(`.seat[data-seat="${moveSource.seatId}"]`)?.classList.add("seat--move-source");
}

async function performMove(targetSeatId) {
  const { seatId: fromSeatId, occupant } = moveSource;
  exitMoveMode();

  // 낙관적 업데이트: 서버 응답을 기다리지 않고 화면부터 옮겨서 즉시 반응하게 한다.
  const prevSeats = currentSeats;
  const next = { ...currentSeats };
  delete next[fromSeatId];
  next[targetSeatId] = occupant;
  currentSeats = next;
  rerenderSeats();
  glowSeat(targetSeatId);

  const toast = showProcessingToast("자리 이동 처리 중입니다...");
  pendingMutationCount++;
  try {
    const res = await apiPost("moveSeat", { 회원ID: occupant.회원ID, 타임: currentTime, 좌석: targetSeatId });
    if (res.success) {
      toast.complete(`${occupant.이름}님 ${targetSeatId}로 이동 완료했습니다`);
    } else {
      currentSeats = prevSeats; // 서버가 거절했으니 화면도 원래대로 되돌린다
      rerenderSeats();
      toast.fail(res.error || "자리 이동에 실패했습니다.");
    }
  } catch (e) {
    currentSeats = prevSeats;
    rerenderSeats();
    toast.fail("네트워크 오류로 자리 이동에 실패했습니다.");
  } finally {
    pendingMutationCount--;
  }
}

async function cancelCheckin() {
  if (!occupantContext) return;
  const { seatId, occupant } = occupantContext;
  if (!confirm(`${occupant.이름} (${seatId}) 체크인을 취소할까요?`)) return;
  closeOccupantModal();

  const prevSeats = currentSeats;
  const next = { ...currentSeats };
  delete next[seatId];
  currentSeats = next;
  rerenderSeats();

  const toast = showProcessingToast("체크인 취소 처리 중입니다...");
  pendingMutationCount++;
  try {
    const res = await apiPost("cancelCheckin", { 회원ID: occupant.회원ID, 타임: currentTime });
    if (res.success) {
      toast.complete(`${occupant.이름}님 체크인 취소 완료했습니다`);
    } else {
      currentSeats = prevSeats;
      rerenderSeats();
      toast.fail(res.error || "체크인 취소에 실패했습니다.");
    }
  } catch (e) {
    currentSeats = prevSeats;
    rerenderSeats();
    toast.fail("네트워크 오류로 체크인 취소에 실패했습니다.");
  } finally {
    pendingMutationCount--;
  }
}

/* ===== 학년/반 필터링 뷰 ===== */

function populateFilterSelect() {
  const prev = filterSelect.value || "all";
  const gradeOptions = GRADE_GROUPS.map(
    (g) => `<option value="grade:${g.key}">${g.label}</option>`
  ).join("");
  const classes = [...new Set(allMembers.map((m) => abbreviateClass(m.학년반)).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ko", { numeric: true })
  );
  const classOptions = classes.map((c) => `<option value="class:${c}">${c}</option>`).join("");
  filterSelect.innerHTML =
    `<option value="all">전체</option>` +
    `<optgroup label="학년">${gradeOptions}</optgroup>` +
    (classOptions ? `<optgroup label="반">${classOptions}</optgroup>` : "");
  // 명단 로드 후 반 목록이 늦게 채워질 때, 이미 골라둔 필터가 있으면 유지한다.
  filterSelect.value = [...filterSelect.options].some((o) => o.value === prev) ? prev : "all";
}

/** 필터가 켜져 있으면 배경을 어둡게 하고 매칭되는 좌석만 또렷하게 남긴다. */
function applyFilter() {
  const active = currentFilter.type !== "all";
  seatMapEl.classList.toggle("seat-map--filtering", active);
  for (const btn of seatMapEl.querySelectorAll(".seat")) {
    let match = false;
    if (active) {
      const occ = currentSeats[btn.dataset.seat];
      if (occ) {
        if (currentFilter.type === "grade") {
          match = getGradeGroup(occ.학년반)?.key === currentFilter.key;
        } else {
          match = abbreviateClass(occ.학년반) === currentFilter.value;
        }
      }
    }
    btn.classList.toggle("seat--filter-match", match);
  }
}

async function openAssignModal(seatId) {
  pendingSeatId = seatId;
  assignModalTitle.textContent = `${seatId} 좌석에 배정할 학생 검색`;
  assignSearchInput.value = "";
  assignResults.innerHTML = "";
  searchResults = [];
  activeResultIndex = -1;
  assignModal.style.display = "flex";

  if (!allMembers.length) {
    assignSearchInput.disabled = true;
    assignSearchInput.placeholder = "명단 불러오는 중...";
    await membersReady;
    assignSearchInput.disabled = false;
    assignSearchInput.placeholder = "이름, 회원ID, 학년반 검색";
  }
  assignSearchInput.focus();
}

function closeAssignModal() {
  assignModal.style.display = "none";
  pendingSeatId = null;
}

let searchResults = [];
let activeResultIndex = -1;

/** 검색어와 일치하는 부분을 <mark>로 감싸 강조 표시 (innerHTML 없이 안전하게 구성). */
function highlightMatch(text, query) {
  const frag = document.createDocumentFragment();
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || idx === -1) {
    frag.append(text);
    return frag;
  }
  frag.append(text.slice(0, idx));
  const mark = document.createElement("mark");
  mark.className = "modal-panel__match";
  mark.textContent = text.slice(idx, idx + query.length);
  frag.append(mark, text.slice(idx + query.length));
  return frag;
}

function renderResultRows(query) {
  assignResults.innerHTML = "";
  searchResults.forEach((member, i) => {
    const row = document.createElement("div");
    row.className = "modal-panel__result text-body on-light";
    if (i === activeResultIndex) row.classList.add("modal-panel__result--active");

    const nameSpan = document.createElement("span");
    nameSpan.append(highlightMatch(member.이름, query));

    const metaSpan = document.createElement("span");
    metaSpan.className = "text-caption";
    metaSpan.style.color = "var(--color-ink-muted-48)";
    metaSpan.textContent = ` ${abbreviateClass(member.학년반)} · ${member.회원ID}`;

    row.append(nameSpan, metaSpan);
    row.addEventListener("click", () => assignMember(member));
    assignResults.appendChild(row);
  });
}

/** allMembers는 페이지 로드시 한 번만 받아온 캐시라, 검색은 네트워크 왕복 없이 즉시 필터링된다. */
function runSearch(q) {
  if (!q) {
    searchResults = [];
    activeResultIndex = -1;
    assignResults.innerHTML = "";
    return;
  }
  const query = q.toLowerCase();
  searchResults = allMembers
    .filter(
      (m) =>
        m.회원ID.toLowerCase().includes(query) ||
        m.이름.toLowerCase().includes(query) ||
        m.학년반.toLowerCase().includes(query)
    )
    .slice(0, MAX_SEARCH_RESULTS);
  activeResultIndex = searchResults.length ? 0 : -1;
  renderResultRows(q);
}

function moveActiveResult(delta) {
  if (!searchResults.length) return;
  activeResultIndex = (activeResultIndex + delta + searchResults.length) % searchResults.length;
  renderResultRows(assignSearchInput.value.trim());
  assignResults.children[activeResultIndex]?.scrollIntoView({ block: "nearest" });
}

/** 이미 "출석했지만 미배정" 상태(UNASSIGNED-* 좌석)인 학생인지 찾는다. */
function findUnassignedSeatForMember(memberId) {
  for (const [seatId, occ] of Object.entries(currentSeats)) {
    if (seatId.startsWith(UNASSIGNED_SEAT_PREFIX) && occ.회원ID === memberId) return seatId;
  }
  return null;
}

/**
 * 빈 좌석을 클릭해 학생을 검색·선택하는 흐름. 그 학생이 이미 "출석했지만 미배정"
 * 목록에 있는 경우, 신규 체크인(checkin)을 시도하면 이미 그 타임에 체크인된
 * 회원이라 서버가 거부한다 — 그래서 이 경우는 자리 이동(moveSeat)으로 대신 처리해
 * UNASSIGNED 항목을 실제 좌석으로 옮긴다. (칩을 먼저 클릭해 이동 모드로 들어가는
 * 기존 흐름과 결과는 동일하고, 진입 경로만 다르다.)
 */
async function assignMember(member) {
  const seatId = pendingSeatId;
  closeAssignModal();

  const unassignedSeatId = findUnassignedSeatForMember(member.회원ID);

  // 낙관적 업데이트: 서버 응답을 기다리지 않고 화면부터 배정 처리해 즉시 반응하게 한다.
  const prevSeats = currentSeats;
  const next = { ...currentSeats };
  if (unassignedSeatId) delete next[unassignedSeatId];
  next[seatId] = { 회원ID: member.회원ID, 이름: member.이름, 학년반: member.학년반 };
  currentSeats = next;
  rerenderSeats();

  const toast = showProcessingToast("배정 처리 중입니다...");
  pendingMutationCount++;
  try {
    const res = unassignedSeatId
      ? await apiPost("moveSeat", { 회원ID: member.회원ID, 타임: currentTime, 좌석: seatId })
      : await apiPost("checkin", {
          회원ID: member.회원ID,
          이름: member.이름,
          학년반: member.학년반,
          좌석: seatId,
          타임: currentTime,
        });
    if (res.success) {
      toast.complete(`${member.이름}님 ${seatId} 배정 완료했습니다`);
    } else {
      currentSeats = prevSeats;
      rerenderSeats();
      toast.fail(res.error || "체크인에 실패했습니다.");
    }
  } catch (e) {
    currentSeats = prevSeats;
    rerenderSeats();
    toast.fail("네트워크 오류로 배정에 실패했습니다.");
  } finally {
    pendingMutationCount--;
  }
}

let locateResults = [];
let locateActiveIndex = -1;

function findSeatForMember(memberId) {
  for (const [seatId, occ] of Object.entries(currentSeats)) {
    if (occ.회원ID === memberId) return seatId;
  }
  return null;
}

function renderLocateResults(query) {
  locateResultsEl.innerHTML = "";
  if (!locateResults.length) {
    locateResultsEl.style.display = "none";
    return;
  }
  locateResultsEl.style.display = "flex";
  locateResults.forEach((member, i) => {
    const row = document.createElement("div");
    row.className = "modal-panel__result text-body on-light";
    if (i === locateActiveIndex) row.classList.add("modal-panel__result--active");

    const nameSpan = document.createElement("span");
    nameSpan.append(highlightMatch(member.이름, query));

    const metaSpan = document.createElement("span");
    metaSpan.className = "text-caption";
    metaSpan.style.color = "var(--color-ink-muted-48)";
    metaSpan.textContent = ` ${abbreviateClass(member.학년반)} · ${findSeatForMember(member.회원ID)}`;

    row.append(nameSpan, metaSpan);
    row.addEventListener("click", () => locateMember(member));
    locateResultsEl.appendChild(row);
  });
}

/** 좌석 찾기는 "이미 배정된" 학생만 대상으로 한다 — 못 찾은 학생을 반짝일 좌석이 없으니까. */
function runLocateSearch(q) {
  if (!q) {
    locateResults = [];
    locateActiveIndex = -1;
    renderLocateResults(q);
    return;
  }
  const query = q.toLowerCase();
  const seatedIds = new Set(Object.values(currentSeats).map((o) => o.회원ID));
  locateResults = allMembers
    .filter((m) => seatedIds.has(m.회원ID))
    .filter(
      (m) =>
        m.회원ID.toLowerCase().includes(query) ||
        m.이름.toLowerCase().includes(query) ||
        m.학년반.toLowerCase().includes(query)
    )
    .slice(0, MAX_SEARCH_RESULTS);
  locateActiveIndex = locateResults.length ? 0 : -1;
  renderLocateResults(q);
}

function moveLocateActive(delta) {
  if (!locateResults.length) return;
  locateActiveIndex = (locateActiveIndex + delta + locateResults.length) % locateResults.length;
  renderLocateResults(locateSearchInput.value.trim());
  locateResultsEl.children[locateActiveIndex]?.scrollIntoView({ block: "nearest" });
}

/** 좌석 버튼을 찾아 화면에 스크롤해서 보여주고 몇 초간 반짝이게 한다. */
function glowSeat(seatId) {
  const btn = seatMapEl.querySelector(`.seat[data-seat="${seatId}"]`);
  if (!btn) return;
  btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
  btn.classList.add("seat--glow");
  clearTimeout(btn._glowTimer);
  btn._glowTimer = setTimeout(() => btn.classList.remove("seat--glow"), 3000);
}

function locateMember(member) {
  const seatId = findSeatForMember(member.회원ID);
  if (!seatId) return;
  glowSeat(seatId);
  locateSearchInput.value = "";
  locateResults = [];
  locateActiveIndex = -1;
  renderLocateResults("");
}

locateSearchInput.addEventListener("input", (e) => runLocateSearch(e.target.value.trim()));
locateSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveLocateActive(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveLocateActive(-1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (locateActiveIndex >= 0 && locateResults[locateActiveIndex]) {
      locateMember(locateResults[locateActiveIndex]);
    }
  } else if (e.key === "Escape") {
    locateSearchInput.value = "";
    locateResults = [];
    locateActiveIndex = -1;
    renderLocateResults("");
    locateSearchInput.blur();
  }
});

assignSearchInput.addEventListener("input", (e) => runSearch(e.target.value.trim()));
assignSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveActiveResult(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveActiveResult(-1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeResultIndex >= 0 && searchResults[activeResultIndex]) {
      assignMember(searchResults[activeResultIndex]);
    }
  } else if (e.key === "Escape") {
    closeAssignModal();
  }
});
assignCancelBtn.addEventListener("click", closeAssignModal);
occupantCloseBtn.addEventListener("click", closeOccupantModal);
occupantMoveBtn.addEventListener("click", enterMoveMode);
occupantCancelCheckinBtn.addEventListener("click", cancelCheckin);
moveCancelBtn.addEventListener("click", exitMoveMode);
refreshBtn.addEventListener("click", loadSeats);

filterSelect.addEventListener("change", () => {
  const value = filterSelect.value;
  if (value === "all") currentFilter = { type: "all" };
  else if (value.startsWith("grade:")) currentFilter = { type: "grade", key: value.slice(6) };
  else currentFilter = { type: "class", value: value.slice(6) };
  applyFilter();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && moveSource) exitMoveMode();
});

renderGradeLegend();
populateFilterSelect(); // 반 목록은 명단 로드 후 채워지고, 학년 그룹은 즉시 표시
membersReady.then(populateFilterSelect);
refreshTabs();
rerenderSeats(); // 좌석 상태를 아직 모를 때도 즉시 빈 좌석판을 그려서 "로딩 중" 공백을 없앤다
loadSeats();
refreshActiveTimes();
setInterval(loadSeats, 15000);
setInterval(refreshActiveTimes, 15000);
// 다른 사용자의 배정/이동/취소를 폴링 없이 즉시 반영 (15초 폴링은 안전망으로 유지).
subscribeToSeatChanges(() => loadSeats());
