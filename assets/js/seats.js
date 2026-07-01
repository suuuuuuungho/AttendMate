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

let currentTime = TIMES[0];
let currentSeats = {};
let pendingSeatId = null;

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

function openAssignModal(seatId) {
  pendingSeatId = seatId;
  assignModalTitle.textContent = `${seatId} 좌석에 배정할 학생 검색`;
  assignSearchInput.value = "";
  assignResults.innerHTML = "";
  searchResults = [];
  activeResultIndex = -1;
  assignModal.style.display = "flex";
  assignSearchInput.focus();
}

function closeAssignModal() {
  assignModal.style.display = "none";
  pendingSeatId = null;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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

const runSearch = debounce(async (q) => {
  if (!q) {
    searchResults = [];
    activeResultIndex = -1;
    assignResults.innerHTML = "";
    return;
  }
  const res = await apiGet("searchMembers", { q });
  searchResults = res.results || [];
  activeResultIndex = searchResults.length ? 0 : -1;
  renderResultRows(q);
}, 120);

function moveActiveResult(delta) {
  if (!searchResults.length) return;
  activeResultIndex = (activeResultIndex + delta + searchResults.length) % searchResults.length;
  renderResultRows(assignSearchInput.value.trim());
  assignResults.children[activeResultIndex]?.scrollIntoView({ block: "nearest" });
}

async function assignMember(member) {
  const res = await apiPost("checkin", {
    회원ID: member.회원ID,
    이름: member.이름,
    학년반: member.학년반,
    좌석: pendingSeatId,
    타임: currentTime,
  });
  if (res.success) {
    closeAssignModal();
    loadSeats();
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
