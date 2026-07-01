import { TIMES } from "./config.js";
import { apiGet, apiPost } from "./api.js";
import { renderSeatMap } from "./seat-map.js";
import { renderTimeTabs } from "./time-tabs.js";

const timeTabsEl = document.getElementById("timeTabs");
const scanStatusEl = document.getElementById("scanStatus");
const scanOverlay = document.getElementById("scanOverlay");
const scanMemberInfo = document.getElementById("scanMemberInfo");
const scanSeatMapEl = document.getElementById("scanSeatMap");
const scanCancelBtn = document.getElementById("scanCancelBtn");

let currentTime = TIMES[0];
let html5QrCode = null;
let currentMember = null;

function refreshTabs() {
  renderTimeTabs(timeTabsEl, TIMES, currentTime, (time) => {
    currentTime = time;
    refreshTabs();
  });
}

function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = "toast toast--" + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

async function onScanSuccess(decodedText) {
  if (scanOverlay.style.display === "flex") return; // 이미 처리 중이면 무시
  const memberId = decodedText.trim();
  const res = await apiGet("getMember", { id: memberId });
  if (!res.found) {
    showToast("등록되지 않은 QR입니다: " + memberId, "error");
    return;
  }
  currentMember = res;
  scanMemberInfo.textContent = `${res.이름} · ${res.학년반}`;
  const seatsRes = await apiGet("getSeats", { time: currentTime });
  renderSeatMap(scanSeatMapEl, seatsRes.seats || {}, {
    selectable: true,
    onSeatClick: (seatId, occupant) => {
      if (occupant) return; // 이미 찬 좌석은 무시
      handleSeatSelect(seatId);
    },
  });
  scanOverlay.style.display = "flex";
  if (html5QrCode) html5QrCode.pause(true);
}

async function handleSeatSelect(seatId) {
  const res = await apiPost("checkin", {
    회원ID: currentMember.회원ID,
    이름: currentMember.이름,
    좌석: seatId,
    타임: currentTime,
  });
  closeOverlay();
  if (res.success) {
    showToast(`체크인 완료 — ${currentMember.이름} · ${seatId}`, "success");
  } else {
    showToast(res.error || "체크인에 실패했습니다.", "error");
  }
}

function closeOverlay() {
  scanOverlay.style.display = "none";
  currentMember = null;
  if (html5QrCode) html5QrCode.resume();
}

scanCancelBtn.addEventListener("click", closeOverlay);

async function startScanner() {
  if (typeof Html5Qrcode === "undefined") {
    scanStatusEl.textContent = "QR 스캐너 라이브러리를 불러오지 못했습니다.";
    return;
  }
  html5QrCode = new Html5Qrcode("qr-reader");
  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      onScanSuccess,
      () => {}
    );
    scanStatusEl.textContent = "QR 코드를 카메라에 비춰주세요";
  } catch (err) {
    scanStatusEl.textContent = "카메라를 사용할 수 없습니다: " + err;
  }
}

refreshTabs();
startScanner();
