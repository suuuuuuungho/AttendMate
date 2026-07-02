import { TIMES } from "./config.js";
import { apiGet, apiPost } from "./api.js";
import { renderSeatMap, abbreviateClass, GRADE_GROUPS } from "./seat-map.js";
import { renderTimeTabs } from "./time-tabs.js";

const timeTabsEl = document.getElementById("timeTabs");
const seatMapEl = document.getElementById("seatMap");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");
const gradeLegendEl = document.getElementById("gradeLegend");

const assignModal = document.getElementById("assignModal");
const assignModalTitle = document.getElementById("assignModalTitle");
const assignSearchInput = document.getElementById("assignSearchInput");
const assignResults = document.getElementById("assignResults");
const assignCancelBtn = document.getElementById("assignCancelBtn");

const occupantModal = document.getElementById("occupantModal");
const occupantModalText = document.getElementById("occupantModalText");
const occupantCloseBtn = document.getElementById("occupantCloseBtn");

const locateSearchInput = document.getElementById("locateSearchInput");
const locateResultsEl = document.getElementById("locateResults");

const MAX_SEARCH_RESULTS = 20;

let currentTime = TIMES[0];
let currentSeats = {};
let pendingSeatId = null;
let allMembers = [];

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
  renderTimeTabs(timeTabsEl, TIMES, currentTime, (time) => {
    currentTime = time;
    refreshTabs();
    loadSeats();
  });
}

/** 좌석 상태를 아직 모를 때도 즉시 빈 좌석판을 그려서 "로딩 중" 공백을 없앤다. */
function renderSeatMapSkeleton() {
  renderSeatMap(seatMapEl, currentSeats, { selectable: true, onSeatClick: handleSeatClick });
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
  const res = await apiGet("getSeats", { time: currentTime });
  currentSeats = res.seats || {};
  renderSeatMap(seatMapEl, currentSeats, { selectable: true, onSeatClick: handleSeatClick });
  lastUpdatedEl.textContent = formatUpdatedTime(new Date()) + " Updated";
}

function handleSeatClick(seatId, occupant) {
  if (occupant) {
    occupantModalText.textContent = `${seatId} — ${occupant.이름} · ${abbreviateClass(occupant.학년반)}`;
    occupantModal.style.display = "flex";
  } else {
    openAssignModal(seatId);
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

async function assignMember(member) {
  const seatId = pendingSeatId;
  const res = await apiPost("checkin", {
    회원ID: member.회원ID,
    이름: member.이름,
    학년반: member.학년반,
    좌석: seatId,
    타임: currentTime,
  });
  if (res.success) {
    closeAssignModal();
    // 서버에 다시 물어보지 않고 방금 배정한 좌석만 즉시 반영 (다음 15초 폴링에서 최종 동기화됨).
    currentSeats = { ...currentSeats, [seatId]: { 회원ID: member.회원ID, 이름: member.이름, 학년반: member.학년반 } };
    renderSeatMap(seatMapEl, currentSeats, { selectable: true, onSeatClick: handleSeatClick });
  } else {
    alert(res.error || "체크인에 실패했습니다.");
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
occupantCloseBtn.addEventListener("click", () => (occupantModal.style.display = "none"));
refreshBtn.addEventListener("click", loadSeats);

renderGradeLegend();
refreshTabs();
renderSeatMapSkeleton();
loadSeats();
setInterval(loadSeats, 15000);
