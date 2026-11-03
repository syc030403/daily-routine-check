// 앱 시작점: 화면들을 연결하고 첫 화면을 그린 뒤 동기화를 시작함
import { todayKey } from "./dates.js";
import { renderCalendar, setDateSelectHandler } from "./calendar.js";
import { renderDayView } from "./dayView.js";
import { initSync } from "./sync.js";

// 달력에서 오늘이 아닌 날짜를 눌렀을 때 뜨는 화면
const dayDetail = document.getElementById("dayDetail");
let detailDateKey = null;

function openDayDetail(dateKey) {
  detailDateKey = dateKey;
  renderDayView(document.getElementById("detailView"), dateKey);
  dayDetail.hidden = false;
  dayDetail.scrollTop = 0;
}

document.getElementById("backBtn").addEventListener("click", () => {
  dayDetail.hidden = true;
});

// 화면 넘기기: 스와이프는 브라우저가 처리하고, 탭은 터치 없는 환경에서도 넘길 수 있게 함
const pager = document.getElementById("pager");
const calendarTab = document.getElementById("calendarTab");
const todayTab = document.getElementById("todayTab");

function goToPage(index) {
  pager.scrollTo({ left: pager.clientWidth * index });
}

calendarTab.addEventListener("click", () => goToPage(0));
todayTab.addEventListener("click", () => goToPage(1));
pager.addEventListener("scroll", () => {
  const onToday = pager.scrollLeft > pager.clientWidth / 2;
  todayTab.classList.toggle("active", onToday);
  calendarTab.classList.toggle("active", !onToday);
});

let renderPending = false;

// 글을 쓰는 중에 다시 그리면 커서와 키보드가 사라지므로 입력이 끝날 때까지 미룸.
// 빈 입력창에 커서만 있거나 다른 창을 보고 있으면 입력 중이 아니니 바로 그림
function renderAll() {
  const active = document.activeElement;
  if (document.hasFocus() && active && active.tagName === "INPUT" && active.type === "text" && active.value) {
    renderPending = true;
    return;
  }
  renderPending = false;
  renderCalendar();
  renderDayView(document.getElementById("todayView"), todayKey);
  if (!dayDetail.hidden) renderDayView(document.getElementById("detailView"), detailDateKey);
}

document.addEventListener("focusout", () => {
  // 포커스가 다른 입력창으로 옮겨 가는 중일 수 있어 이동이 끝난 뒤 판단
  setTimeout(() => { if (renderPending) renderAll(); }, 0);
});

setDateSelectHandler((dateKey) => {
  if (dateKey === todayKey) goToPage(1);
  else openDayDetail(dateKey);
});

renderCalendar();
renderDayView(document.getElementById("todayView"), todayKey);
initSync(renderAll);
