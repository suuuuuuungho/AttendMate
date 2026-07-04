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
 * 학년반 원문에서 학년 그룹을 뽑아낸다. 좌석 배경색을 학년별로 다르게 칠하는 데 쓴다.
 * 순서가 중요하다 — "신입"/"장기섬김"이 "학년" 숫자보다 먼저 매칭되어야 한다.
 */
// 학년반 원문은 두 형식이 섞여 있다: 목업/구글시트의 "중등부 1학년 1-1반"과
// 실제 Supabase Member 데이터의 "1-1반"(학년 접두어 없이 숫자-반 형식). 둘 다 매칭한다.
export const GRADE_GROUPS = [
  { key: "grade1", label: "1학년", match: /1학년|^1-\d/, cssVar: "--color-grade-1" },
  { key: "grade2", label: "2학년", match: /2학년|^2-\d/, cssVar: "--color-grade-2" },
  { key: "grade3", label: "3학년", match: /3학년|^3-\d/, cssVar: "--color-grade-3" },
  { key: "new", label: "신입반", match: /신입/, cssVar: "--color-grade-new" },
  { key: "longterm", label: "장기섬김", match: /장기섬김/, cssVar: "--color-grade-longterm" },
];

export function getGradeGroup(cls) {
  if (!cls) return null;
  return GRADE_GROUPS.find((g) => g.match.test(cls)) || null;
}

/** 좌석 버튼 하나의 상태(클래스/내용물)를 원하는 상태로 맞춘다. 최초 생성과 갱신이 공유. */
function applySeatState(btn, seatId, occupant, selectedSeat, selectable) {
  const n = seatId.slice(1);
  // 좌석 찾기 글로우가 폴링 갱신에 지워지지 않도록 보존한다.
  const hasGlow = btn.classList.contains("seat--glow");
  btn.className = "seat";
  if (hasGlow) btn.classList.add("seat--glow");
  btn.disabled = false;
  btn.textContent = "";
  btn.removeAttribute("title");

  if (occupant) {
    btn.classList.add("seat--taken");
    const grade = getGradeGroup(occupant.학년반);
    btn.classList.add(grade ? `seat--${grade.key}` : "seat--grade-other");
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
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, {회원ID: string, 이름: string, 학년반: string}>} seatStatus - 점유된 좌석만 담긴 맵
 * @param {{selectable?: boolean, selectedSeat?: string|null, onSeatClick?: (seatId:string, occupant:object|null)=>void}} opts
 *
 * DOM은 최초 호출에서 한 번만 만들고, 이후 호출(15초 폴링/좌석 배정)에서는 좌석 버튼의
 * 상태만 제자리에서 갱신한다. 스크롤 컨테이너를 부수고 다시 만들지 않으므로 스크롤
 * 위치가 리셋될 여지가 아예 없다 — 이전에는 재렌더링 후 scrollLeft를 "복원"하는
 * 방식이었는데, smooth 스크롤 애니메이션 도중이거나 브라우저별 타이밍에 따라
 * 복원값이 씹히면서 A구역으로 튕기는 문제가 재발했다.
 *
 * 클릭은 640개 버튼 각각이 아니라 container에 리스너 하나만 붙여 이벤트 위임으로 처리.
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

  // 이미 만들어져 있으면 좌석 상태만 갱신하고 끝 — 스크롤은 손대지 않는다.
  if (container._seatMapBuilt) {
    for (const btn of container.querySelectorAll(".seat")) {
      applySeatState(btn, btn.dataset.seat, seatStatus[btn.dataset.seat] || null, selectedSeat, selectable);
    }
    return;
  }

  container.innerHTML = "";
  container.classList.add("seat-map");

  const scrollEl = document.createElement("div");
  scrollEl.className = "seat-map__scroll";

  // rowsEl에 transform: scale()을 걸면 scrollEl의 scrollWidth가 축소된 시각적
  // 크기를 안정적으로 반영하지 않는 경우가 있어서(끝까지 스크롤해도 빈 공간이 남음),
  // 실제 스케일된 크기로 명시적 width/height를 잡아주는 래퍼를 하나 둔다.
  const scaleWrapEl = document.createElement("div");
  scaleWrapEl.className = "seat-map__scale-wrap";

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
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "seat";
        btn.dataset.seat = seatId;
        applySeatState(btn, seatId, seatStatus[seatId] || null, selectedSeat, selectable);
        grid.appendChild(btn);
      }

      sectionEl.appendChild(grid);
      rowEl.appendChild(sectionEl);
    }

    rowsEl.appendChild(rowEl);
  }

  scaleWrapEl.appendChild(rowsEl);
  scrollEl.appendChild(scaleWrapEl);
  container.appendChild(scrollEl);
  container._seatMapBuilt = true;

  lastFit = { scrollEl, scaleWrapEl, rowsEl };
  fitToWidth();
}

/**
 * scrollLeft를 애니메이션 없이 즉시 적용한다. `scrollTo({behavior:"instant"})`는
 * 표준 값이 아니라서(공식 스펙엔 "auto"/"smooth"뿐) 사파리 등 일부 브라우저에서
 * 무시되거나 다르게 동작할 수 있다 — 그래서 CSS의 scroll-behavior:smooth를
 * 인라인 스타일로 잠깐 "auto"로 덮어써서 확실하게 즉시 이동시킨다.
 */
function setScrollLeftInstant(scrollEl, left) {
  const prevBehavior = scrollEl.style.scrollBehavior;
  scrollEl.style.scrollBehavior = "auto";
  scrollEl.scrollLeft = left;
  scrollEl.style.scrollBehavior = prevBehavior;
}

// 전체 좌석판(강단 포함)이 화면 폭에 맞춰 한 번에 들어오도록 축소한다 (영화관 좌석
// 예매 화면처럼 전체가 한눈에 보이고 두 줄+강단이 항상 같은 비율로 함께 움직인다).
// 좌석이 안 보일 정도로 작아지지 않도록 MIN_SCALE 밑으로는 축소하지 않고, 그보다
// 더 넘치는 부분은 .seat-map__scroll의 가로 스크롤로 본다 (여전히 강단+두 줄이 함께 움직임).
const MIN_SCALE = 0.6;
let lastFit = null;

function fitToWidth() {
  if (!lastFit) return;
  const { scrollEl, scaleWrapEl, rowsEl } = lastFit;
  // 리사이즈(예: 모바일 브라우저 주소창이 스크롤 중 접히면서 뷰포트 높이/폭이 바뀌는
  // 경우)로도 이 함수가 호출된다. transform을 다시 계산하는 동안 스크롤 가능 범위가
  // 잠깐 바뀌면서 scrollLeft가 브라우저에 의해 잘려나갈 수 있어서, 항상 이 함수
  // 안에서 자기 자신의 scrollLeft를 캡처했다가 그대로 복원한다.
  const prevScrollLeft = scrollEl.scrollLeft;
  rowsEl.style.transform = "none";
  scaleWrapEl.style.width = "";
  scaleWrapEl.style.height = "";
  const contentWidth = rowsEl.scrollWidth;
  const contentHeight = rowsEl.scrollHeight;
  const availableWidth = scrollEl.clientWidth;
  if (!contentWidth || !availableWidth) return;
  const scale = Math.max(MIN_SCALE, Math.min(1, availableWidth / contentWidth));
  rowsEl.style.transformOrigin = "top left";
  rowsEl.style.transform = `scale(${scale})`;
  // scaleWrapEl에 스케일된 실제 크기를 명시적으로 지정해야, scrollEl의 스크롤 가능
  // 범위가 (transform으로는 신뢰할 수 없는) 시각적 크기와 정확히 일치한다 — 안 그러면
  // 끝까지 스크롤했을 때 빈 여백만 남는 경우가 있었다.
  scaleWrapEl.style.width = contentWidth * scale + "px";
  scaleWrapEl.style.height = contentHeight * scale + "px";
  setScrollLeftInstant(scrollEl, prevScrollLeft);
}

if (typeof window !== "undefined" && !window._seatMapResizeBound) {
  window.addEventListener("resize", () => {
    clearTimeout(window._seatMapResizeTimer);
    window._seatMapResizeTimer = setTimeout(fitToWidth, 150);
  });
  window._seatMapResizeBound = true;
}
