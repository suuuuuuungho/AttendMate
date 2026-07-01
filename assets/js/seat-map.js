// 640석 극장식 좌석 배치 — 8구역(A~H), 위/아래 두 층에 4구역씩.
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

export const SEAT_FLOORS = [
  ["A", "B", "C", "D"],
  ["E", "F", "G", "H"],
];

/**
 * @param {HTMLElement} container
 * @param {Record<string, {회원ID: string, 이름: string}>} seatStatus - 점유된 좌석만 담긴 맵
 * @param {{selectable?: boolean, selectedSeat?: string|null, onSeatClick?: (seatId:string, occupant:object|null)=>void}} opts
 */
export function renderSeatMap(container, seatStatus, opts = {}) {
  const { selectable = true, selectedSeat = null, onSeatClick = () => {} } = opts;

  container.innerHTML = "";
  container.classList.add("seat-map");

  for (const floorIds of SEAT_FLOORS) {
    const floorEl = document.createElement("div");
    floorEl.className = "seat-map__floor";

    for (const sectionId of floorIds) {
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
        btn.textContent = n;
        btn.dataset.seat = seatId;

        if (occupant) {
          btn.classList.add("seat--taken");
          btn.title = occupant.이름 || "";
          btn.addEventListener("click", () => onSeatClick(seatId, occupant));
        } else if (seatId === selectedSeat) {
          btn.classList.add("seat--selected");
          btn.addEventListener("click", () => onSeatClick(seatId, null));
        } else {
          btn.classList.add("seat--available");
          if (!selectable) btn.disabled = true;
          else btn.addEventListener("click", () => onSeatClick(seatId, null));
        }

        grid.appendChild(btn);
      }

      sectionEl.appendChild(grid);
      floorEl.appendChild(sectionEl);
    }

    container.appendChild(floorEl);
  }
}
