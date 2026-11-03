// 날짜별 루틴/계획 화면: 오늘 화면과 달력에서 연 날짜 화면이 같은 코드를 씀
import { getWeekdayLabel, todayKey } from "./dates.js";
import { renderCalendar } from "./calendar.js";
import {
  addRoutine,
  data,
  getEntry,
  getPlans,
  getRoutines,
  getSubs,
  laterEntryKeys,
  removeRoutine,
  saveData
} from "./store.js";

let memoTimer = null;

// 로그아웃 전에 입력 중이던 메모까지 저장
export function flushMemo() {
  clearTimeout(memoTimer);
  saveData();
}

// 펼쳐 둔 루틴. 앱을 다시 열면 전부 접힌 상태로 시작하도록 저장하지 않음
const expandedRoutines = new Set();

export function renderDayView(root, dateKey) {
  root.innerHTML = "";

  function refresh() {
    saveData();
    renderDayView(root, dateKey);
    renderCalendar();
  }

  const title = document.createElement("h2");
  title.className = "day-title";
  title.textContent = dateKey + " (" + getWeekdayLabel(dateKey) + ")";
  root.appendChild(title);

  const routineTitle = document.createElement("h3");
  routineTitle.className = "section-title";
  routineTitle.textContent = "루틴";
  root.appendChild(routineTitle);

  // 루틴 추가 입력창: 어떻게 적용되는지 입력창에서 바로 알 수 있게 함
  const form = document.createElement("form");
  form.className = "add-item-row routine-add";
  const newItemInput = document.createElement("input");
  newItemInput.type = "text";
  newItemInput.placeholder = dateKey < todayKey ? "루틴 추가 (이 날만)" : "루틴 추가 (이 날부터 매일)";
  newItemInput.setAttribute("aria-label", "루틴 추가");
  const addBtn = document.createElement("button");
  addBtn.type = "submit";
  addBtn.textContent = "추가";
  form.appendChild(newItemInput);
  form.appendChild(addBtn);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newItemInput.value.trim();
    newItemInput.value = "";
    if (!name || getRoutines(dateKey).includes(name)) return;
    addRoutine(dateKey, name);
    refresh();
    root.querySelector(".routine-add input").focus();
  });
  root.appendChild(form);

  // 체크리스트
  const list = document.createElement("div");
  list.className = "checklist";
  const routines = getRoutines(dateKey);
  if (routines.length === 0) {
    const empty = document.createElement("div");
    empty.className = "checklist-empty";
    empty.textContent = "위에서 루틴을 추가해보세요";
    list.appendChild(empty);
  }
  routines.forEach((item, routineIndex) => {
    const checked = !!(data[dateKey] && data[dateKey].checks[item]);
    const row = document.createElement("div");
    row.className = "check-item" + (checked ? " done" : "");

    const main = document.createElement("div");
    main.className = "check-main";

    const label = document.createElement("label");
    label.className = "check-label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => {
      getEntry(dateKey).checks[item] = input.checked;
      refresh();
    });
    const span = document.createElement("span");
    span.className = "label";
    span.textContent = item;
    label.appendChild(input);
    label.appendChild(span);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", item + " 삭제");
    deleteBtn.addEventListener("click", () => {
      removeRoutine(dateKey, item);
      refresh();
    });

    main.appendChild(label);
    main.appendChild(deleteBtn);
    row.appendChild(main);

    // 세부 루틴: 루틴과 같은 규칙으로 오늘 화면에서 고친 내용만 다음 날로 이어짐
    const subList = document.createElement("div");
    subList.className = "sub-list";
    const subs = getSubs(dateKey, item);
    let subDoneCount = 0;
    subs.forEach((sub) => {
      const subChecked = !!(data[dateKey] && data[dateKey].subs && data[dateKey].subs[item][sub]);
      if (subChecked) subDoneCount++;
      const subRow = document.createElement("div");
      subRow.className = "sub-item" + (subChecked ? " done" : "");

      const subLabel = document.createElement("label");
      subLabel.className = "check-label";
      const subInput = document.createElement("input");
      subInput.type = "checkbox";
      subInput.checked = subChecked;
      subInput.addEventListener("change", () => {
        getEntry(dateKey).subs[item][sub] = subInput.checked;
        refresh();
      });
      const subSpan = document.createElement("span");
      subSpan.className = "label";
      subSpan.textContent = sub;
      subLabel.appendChild(subInput);
      subLabel.appendChild(subSpan);

      const subDeleteBtn = document.createElement("button");
      subDeleteBtn.type = "button";
      subDeleteBtn.className = "delete-btn";
      subDeleteBtn.textContent = "×";
      subDeleteBtn.setAttribute("aria-label", sub + " 삭제");
      subDeleteBtn.addEventListener("click", () => {
        delete getEntry(dateKey).subs[item][sub];
        if (dateKey === todayKey && data.subItems[item]) {
          data.subItems[item] = data.subItems[item].filter((s) => s !== sub);
          laterEntryKeys(dateKey).forEach((key) => {
            if (data[key].subs && data[key].subs[item]) delete data[key].subs[item][sub];
          });
        }
        refresh();
      });

      subRow.appendChild(subLabel);
      subRow.appendChild(subDeleteBtn);
      subList.appendChild(subRow);
    });

    const subForm = document.createElement("form");
    subForm.className = "sub-add";
    const newSubInput = document.createElement("input");
    newSubInput.type = "text";
    newSubInput.placeholder = "세부 루틴 추가";
    newSubInput.setAttribute("aria-label", item + " 세부 루틴 추가");
    const subAddBtn = document.createElement("button");
    subAddBtn.type = "submit";
    subAddBtn.textContent = "+";
    subAddBtn.setAttribute("aria-label", item + "에 세부 루틴 추가");
    subForm.appendChild(newSubInput);
    subForm.appendChild(subAddBtn);
    subForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = newSubInput.value.trim();
      newSubInput.value = "";
      if (!name || getSubs(dateKey, item).includes(name)) return;
      const entry = getEntry(dateKey);
      if (!entry.subs[item]) entry.subs[item] = {};
      entry.subs[item][name] = false;
      if (dateKey === todayKey && data.items.includes(item)) {
        if (!data.subItems[item]) data.subItems[item] = [];
        data.subItems[item].push(name);
        laterEntryKeys(dateKey).forEach((key) => {
          if (data[key].subs && data[key].subs[item]) data[key].subs[item][name] = false;
        });
      }
      refresh();
      root.querySelectorAll(".sub-add input")[routineIndex].focus();
    });
    subList.appendChild(subForm);

    // 펼치기 버튼: 접혀 있어도 세부 루틴 진행 상황이 보이도록 개수를 같이 표시
    const expandKey = dateKey + "\n" + item;
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "sub-toggle";
    const countText = subs.length > 0 ? subDoneCount + "/" + subs.length + " " : "";
    function applyExpanded() {
      const expanded = expandedRoutines.has(expandKey);
      subList.hidden = !expanded;
      toggleBtn.textContent = countText + (expanded ? "▴" : "▾");
      toggleBtn.setAttribute("aria-expanded", String(expanded));
      toggleBtn.setAttribute("aria-label", item + " 세부 루틴 " + (expanded ? "접기" : "펼치기"));
    }
    toggleBtn.addEventListener("click", () => {
      if (expandedRoutines.has(expandKey)) expandedRoutines.delete(expandKey);
      else expandedRoutines.add(expandKey);
      applyExpanded();
    });
    applyExpanded();
    main.insertBefore(toggleBtn, deleteBtn);

    row.appendChild(subList);
    list.appendChild(row);
  });
  root.appendChild(list);

  // 계획: 그 날짜에만 있는 일이라 세부 항목 없이 체크만 함
  const planTitle = document.createElement("h3");
  planTitle.className = "section-title";
  planTitle.textContent = "계획";
  root.appendChild(planTitle);

  const planForm = document.createElement("form");
  planForm.className = "add-item-row plan-add";
  const newPlanInput = document.createElement("input");
  newPlanInput.type = "text";
  newPlanInput.placeholder = "계획 추가 (이 날만)";
  newPlanInput.setAttribute("aria-label", "계획 추가");
  const planAddBtn = document.createElement("button");
  planAddBtn.type = "submit";
  planAddBtn.textContent = "추가";
  planForm.appendChild(newPlanInput);
  planForm.appendChild(planAddBtn);
  planForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newPlanInput.value.trim();
    newPlanInput.value = "";
    if (!name || getPlans(dateKey).includes(name)) return;
    const entry = getEntry(dateKey);
    if (!entry.plans) entry.plans = {};
    entry.plans[name] = false;
    refresh();
    root.querySelector(".plan-add input").focus();
  });
  root.appendChild(planForm);

  const planList = document.createElement("div");
  planList.className = "checklist";
  const plans = getPlans(dateKey);
  if (plans.length === 0) {
    const empty = document.createElement("div");
    empty.className = "checklist-empty";
    empty.textContent = "이 날만 할 일을 적어보세요";
    planList.appendChild(empty);
  }
  plans.forEach((plan) => {
    const checked = !!data[dateKey].plans[plan];
    const row = document.createElement("div");
    row.className = "check-item" + (checked ? " done" : "");
    const main = document.createElement("div");
    main.className = "check-main";

    const label = document.createElement("label");
    label.className = "check-label";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => {
      data[dateKey].plans[plan] = input.checked;
      refresh();
    });
    const span = document.createElement("span");
    span.className = "label";
    span.textContent = plan;
    label.appendChild(input);
    label.appendChild(span);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", plan + " 삭제");
    deleteBtn.addEventListener("click", () => {
      delete data[dateKey].plans[plan];
      refresh();
    });

    main.appendChild(label);
    main.appendChild(deleteBtn);
    row.appendChild(main);
    planList.appendChild(row);
  });
  root.appendChild(planList);

  // 한 줄 메모: 값은 바로 반영하고, 저장만 타이핑이 멈춘 뒤 0.4초 후에 함
  const memoInput = document.createElement("input");
  memoInput.type = "text";
  memoInput.className = "memo-input";
  memoInput.placeholder = dateKey === todayKey ? "오늘 기억나는 문장" : "이 날 기억나는 문장";
  memoInput.setAttribute("aria-label", "한 줄 메모");
  memoInput.value = (data[dateKey] && data[dateKey].memo) || "";
  memoInput.addEventListener("input", () => {
    getEntry(dateKey).memo = memoInput.value;
    clearTimeout(memoTimer);
    memoTimer = setTimeout(saveData, 400);
  });
  root.appendChild(memoInput);
}
