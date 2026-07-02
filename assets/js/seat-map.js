// 640석 극장식 좌석 배치 — 8구역(A~H), 전부 같은 층. 위/아래 두 줄로 배치될 뿐이라
// 가로 스크롤은 두 줄이 같은 위치로 함께 움직여야 한다 (줄마다 따로 스크롤되면 안 됨).
export const SEAT_SECTIONS = [
  { id: "A", cols: 7, rows: 10 },
  { id: "B", cols: 9, rows: 10 },
  { id: "C", cols: 9, rows: 10 },
  { id: "D", cols: 7, rows: 10 },
  { id: "E", cols: 7, rows: 10 },
  { id: "F", cols: 9, rows: 10 },
  { id: "G", cols: 9, rows: 10 },
  { id: "H", cols: 7, rows: 10 },
];

export const SEAT_ROWS = [
  ["A", "B", "C", "D"],
  ["E", "F", "G", "H"],
];

export const STAGE_LABEL = "강단";

/** "중등부 1학년 1-1반" 같은 학년반 표기를 좌석 위에 표시할 "1-1반"로 축약. */
export function abbreviateClass(cls) {
  if (!cls) return "";
  const parts = String(cls).trim().split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, {회원ID: string, 이름: string, 학년반: string}>} seatStatus - 점유된 좌석만 담긴 맵
 * @param {{selectable?: boolean, selectedSeat?: string|null, onSeatClick?: (seatId:string, occupant:object|null)=>void}} opts
 *
 * 640개 좌석 버튼마다 클릭 리스너를 새로 붙이는 대신, container에 리스너 하나만 붙이고
 * 이벤트 위임으로 처리한다 — 재렌더링(폴링/배정)마다 640개 리스너를 만들고 버리는 비용을 없앤다.
 */
export function renderSeatMap(container, seatStatus, opts = {}) {
  const { selectable = true, selectedSeat = null, onSeatClick = () => {} } = opts;

  container._seatStatus = seatStatus;
  container._onSeatClick = onSeatClick;
  container._selectable = selectable;

  if (!container._seatMapBound) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".seat");
      if (!btn || btn.disabled) return;
      const seatId = btn.dataset.seat;
      const occupant = container._seatStatus[seatId] || null;
      if (!occupant && !container._selectable) return;
      container._onSeatClick(seatId, occupant);
    });
    container._seatMapBound = true;
  }

  container.innerHTML = "";
  container.classList.add("seat-map");

  const scrollEl = document.createElement("div");
  scrollEl.className = "seat-map__scroll";

  const rowsEl = document.createElement("div");
  rowsEl.className = "seat-map__rows";

  // "강단" 표시 바를 좌석 줄과 같은 스케일/스크롤 그룹(.seat-map__rows) 안에 넣는다 —
  // 밖에 따로 있으면 좌석판이 확대/축소될 때 강단만 따로 놀게 된다.
  const stageEl = document.createElement("div");
  stageEl.className = "seat-map__stage text-tagline";
  stageEl.textContent = STAGE_LABEL;
  rowsEl.appendChild(stageEl);

  for (const rowIds of SEAT_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "seat-map__row";

    for (const sectionId of rowIds) {
      const section = SEAT_SECTIONS.find((s) => s.id === sectionId);
      const sectionEl = document.createElement("div");
      sectionEl.className = "seat-map__section";

      const label = document.createElement("div");
      label.className = "seat-map__section-label text-caption-strong";
      label.textContent = sectionId + "구역";
      sectionEl.appendChild(label);

      const grid = document.createElement("div");
      grid.className = "seat-map__grid";
      grid.style.gridTemplateColumns = `repeat(${section.cols}, 1fr)`;

      const total = section.cols * section.rows;
      for (let n = 1; n <= total; n++) {
        const seatId = sectionId + n;
        const occupant = seatStatus[seatId] || null;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "seat";
        btn.dataset.seat = seatId;

        if (occupant) {
          btn.classList.add("seat--taken");
          const cls = abbreviateClass(occupant.학년반);
          const nameEl = document.createElement("span");
          nameEl.className = "seat__name";
          nameEl.textContent = occupant.이름 || "";
          const classEl = document.createElement("span");
          classEl.className = "seat__class";
          classEl.textContent = cls;
          btn.append(nameEl, classEl);
          btn.title = `${seatId} — ${occupant.이름 || ""} · ${cls}`;
        } else if (seatId === selectedSeat) {
          btn.textContent = n;
          btn.classList.add("seat--selected");
        } else {
          btn.textContent = n;
          btn.classList.add("seat--available");
          if (!selectable) btn.disabled = true;
        }

        grid.appendChild(btn);
      }

      sectionEl.appendChild(grid);
      rowEl.appendChild(sectionEl);
    }

    rowsEl.appendChild(rowEl);
  }

  scrollEl.appendChild(rowsEl);
  container.appendChild(scrollEl);

  lastFit = { scrollEl, rowsEl };
  fitToWidth();
}

// 전체 좌석판(강단 포함)이 화면 폭에 맞춰 한 번에 들어오도록 축소한다 (영화관 좌석
// 예매 화면처럼 전체가 한눈에 보이고 두 줄+강단이 항상 같은 비율로 함께 움직인다).
// 좌석이 안 보일 정도로 작아지지 않도록 MIN_SCALE 밑으로는 축소하지 않고, 그보다
// 더 넘치는 부분은 .seat-map__scroll의 가로 스크롤로 본다 (여전히 강단+두 줄이 함께 움직임).
const MIN_SCALE = 0.6;
let lastFit = null;

function fitToWidth() {
  if (!lastFit) return;
  const { scrollEl, rowsEl } = lastFit;
  rowsEl.style.transform = "none";
  const contentWidth = rowsEl.scrollWidth;
  const contentHeight = rowsEl.scrollHeight;
  const availableWidth = scrollEl.clientWidth;
  if (!contentWidth || !availableWidth) return;
  const scale = Math.max(MIN_SCALE, Math.min(1, availableWidth / contentWidth));
  rowsEl.style.transformOrigin = "top left";
  rowsEl.style.transform = `scale(${scale})`;
  scrollEl.style.height = contentHeight * scale + "px";
}

if (typeof window !== "undefined" && !window._seatMapResizeBound) {
  window.addEventListener("resize", () => {
    clearTimeout(window._seatMapResizeTimer);
    window._seatMapResizeTimer = setTimeout(fitToWidth, 150);
  });
  window._seatMapResizeBound = true;
}
