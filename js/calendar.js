// 달력 화면
import { WEEKDAYS, getWeekdayLabel, now, toDateKey, todayKey } from "./dates.js";
import { data } from "./store.js";

let viewYear = now.getFullYear();
let viewMonth = now.getMonth();
const calendarGrid = document.getElementById("calendarGrid");

// 날짜를 눌렀을 때 어느 화면을 열지는 main.js가 정함
let onSelectDate = () => {};
export function setDateSelectHandler(handler) {
  onSelectDate = handler;
}

export function renderCalendar() {
  document.getElementById("monthTitle").textContent = viewYear + "년 " + (viewMonth + 1) + "월";
  calendarGrid.innerHTML = "";

  WEEKDAYS.forEach((name) => {
    const el = document.createElement("div");
    el.className = "weekday";
    el.textContent = name;
    calendarGrid.appendChild(el);
  });

  // 1일이 시작하는 요일만큼 빈 칸을 넣어 맞춤
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  for (let i = 0; i < firstWeekday; i++) {
    calendarGrid.appendChild(document.createElement("div"));
  }

  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const dateKey = toDateKey(viewYear, viewMonth, day);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell" + (dateKey === todayKey ? " today" : "");
    cell.textContent = day;

    let ariaLabel = dateKey + " " + getWeekdayLabel(dateKey) + "요일";
    const checks = data[dateKey] && data[dateKey].checks;
    const total = checks ? Object.keys(checks).length : 0;
    if (total > 0) {
      const doneCount = Object.values(checks).filter(Boolean).length;
      const countEl = document.createElement("span");
      countEl.className = "day-count";
      countEl.textContent = doneCount + "/" + total;
      cell.appendChild(countEl);
      ariaLabel += ", " + total + "개 중 " + doneCount + "개 완료";
      if (doneCount === total) cell.classList.add("all-done");
    }
    // 계획은 루틴 달성률에 섞지 않고 남은 개수만 따로 표시
    const plans = (data[dateKey] && data[dateKey].plans) || {};
    const remainingPlans = Object.values(plans).filter((done) => !done).length;
    if (remainingPlans > 0) {
      const planEl = document.createElement("span");
      planEl.className = "day-plan";
      planEl.textContent = "계획 " + remainingPlans;
      cell.appendChild(planEl);
      ariaLabel += ", 남은 계획 " + remainingPlans + "개";
    }
    cell.setAttribute("aria-label", ariaLabel);

    cell.addEventListener("click", () => {
      onSelectDate(dateKey);
    });
    calendarGrid.appendChild(cell);
  }
}

function moveMonth(diff) {
  const d = new Date(viewYear, viewMonth + diff, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  renderCalendar();
}
document.getElementById("prevMonth").addEventListener("click", () => moveMonth(-1));
document.getElementById("nextMonth").addEventListener("click", () => moveMonth(1));
