import { TIMES } from "./config.js";
import { apiGet, apiPost } from "./api.js";
import { renderSeatMap, abbreviateClass } from "./seat-map.js";
import { renderTimeTabs } from "./time-tabs.js";

const timeTabsEl = document.getElementById("timeTabs");
const seatMapEl = document.getElementById("seatMap");
const currentTimeLabelEl = document.getElementById("currentTimeLabel");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");

const assignModal = document.getElementById("assignModal");
const assignModalTitle = document.getElementById("assignModalTitle");
const assignSearchInput = document.getElementById("assignSearchInput");
const assignResults = document.getElementById("assignResults");
const assignCancelBtn = document.getElementById("assignCancelBtn");

const occupantModal = document.getElementById("occupantModal");
const occupantModalText = document.getElementById("occupantModalText");
const occupantCloseBtn = document.getElementById("occupantCloseBtn");

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

function refreshTabs() {
  renderTimeTabs(timeTabsEl, TIMES, currentTime, (time) => {
    currentTime = time;
    refreshTabs();
    loadSeats();
  });
  currentTimeLabelEl.textContent = currentTime;
}

async function loadSeats() {
  const res = await apiGet("getSeats", { time: currentTime });
  currentSeats = res.seats || {};
  renderSeatMap(seatMapEl, currentSeats, { selectable: true, onSeatClick: handleSeatClick });
  lastUpdatedEl.textContent = "마지막 갱신 " + new Date().toLocaleTimeString("ko-KR");
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

refreshTabs();
loadSeats();
setInterval(loadSeats, 15000);
