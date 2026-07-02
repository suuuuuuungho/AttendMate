// index.html이 사용하는 타임 선택 드롭다운 렌더러.
// pill 탭으로 하면 모바일 폭에서 두 줄로 줄바꿈되므로, 화면 크기와 무관하게 한 줄인
// <select> 드롭다운을 쓴다.
export function renderTimeTabs(container, times, current, onSelect) {
  if (!container._timeSelectBound) {
    container.innerHTML = '<select class="time-select"></select>';
    const select = container.querySelector("select");
    select.addEventListener("change", (e) => onSelect(e.target.value));
    container._timeSelectBound = true;
  }

  const select = container.querySelector("select");
  if (select.dataset.times !== times.join(",")) {
    select.innerHTML = times.map((t) => `<option value="${t}">${t}</option>`).join("");
    select.dataset.times = times.join(",");
  }
  select.value = current;
}
