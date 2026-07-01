// index.html이 사용하는 타임(1~7타임) pill 탭 렌더러.
export function renderTimeTabs(container, times, current, onSelect) {
  container.innerHTML = "";
  for (const time of times) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-tab" + (time === current ? " time-tab--selected" : "");
    btn.textContent = time;
    btn.addEventListener("click", () => onSelect(time));
    container.appendChild(btn);
  }
}
