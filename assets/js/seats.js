import { TIMES } from "./config.js";
import { apiGet, apiPost } from "./api.js";
import { renderSeatMap } from "./seat-map.js";
import { renderTimeTabs } from "./time-tabs.js";

const timeTabsEl = document.getElementById("timeTabs");
const seatMapEl = document.getElementById("seatMap");
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
}

async function loadSeats() {
  const res = await apiGet("getSeats", { time: currentTime });
  currentSeats = res.seats || {};
  renderSeatMap(seatMapEl, currentSeats, { selectable: true, onSeatClick: handleSeatClick });
  lastUpdatedEl.textContent = "마지막 갱신 " + new Date().toLocaleTimeString("ko-KR");
}

function handleSeatClick(seatId, occupant) {
  if (occupant) {
    occupantModalText.textContent = `${seatId} — ${occupant.이름}`;
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

const runSearch = debounce(async (q) => {
  if (!q) {
    assignResults.innerHTML = "";
    return;
  }
  const res = await apiGet("searchMembers", { q });
  assignResults.innerHTML = "";
  for (const member of res.results || []) {
    const row = document.createElement("div");
    row.className = "modal-panel__result text-body on-light";
    row.innerHTML = `<span>${member.이름} <span class="text-caption" style="color:var(--color-ink-muted-48)">${member.학년반} · ${member.회원ID}</span></span>`;
    row.addEventListener("click", () => assignMember(member));
    assignResults.appendChild(row);
  }
}, 250);

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
assignCancelBtn.addEventListener("click", closeAssignModal);
occupantCloseBtn.addEventListener("click", () => (occupantModal.style.display = "none"));
refreshBtn.addEventListener("click", loadSeats);

refreshTabs();
loadSeats();
setInterval(loadSeats, 15000);
