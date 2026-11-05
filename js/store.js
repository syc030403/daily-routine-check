// 데이터 저장소: 루틴과 계획의 규칙을 여기에 모아 화면과 동기화가 같은 규칙을 쓰게 함
import { DATE_KEY_PATTERN, todayKey } from "./dates.js";

export const STORAGE_KEY = "routine-log";

// localStorage 읽기/쓰기: 로그인 전 저장소이자, 로그인 후에도 화면을 바로 띄우기 위한 사본.
// 시크릿 모드 등에서 저장이 막혀도 앱이 죽지 않도록 try/catch로 감쌈.
// items(기본 루틴), subItems(기본 세부 루틴), routineDates(루틴별 시작/종료일), 날짜별 기록을 한 객체에 같이 담아서 키 하나로 관리.
// 계획은 그 날짜 기록의 plans에만 있어서 다른 날로 이어지지 않음
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!Array.isArray(parsed.items)) parsed.items = [];
    if (!parsed.subItems) parsed.subItems = {};
    if (!parsed.routineDates) parsed.routineDates = {};
    return parsed;
  } catch (e) {
    return { items: [], subItems: {}, routineDates: {} };
  }
}

export function saveLocalOnly() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // 저장 실패해도 무시하고 화면은 계속 동작
  }
}

// 저장할 때마다 동기화가 알 수 있게 함. 저장소가 동기화 코드에 의존하지 않도록 콜백으로 받음
let saveListener = () => {};
export function setSaveListener(listener) {
  saveListener = listener;
}

export function saveData() {
  saveLocalOnly();
  saveListener();
}

export const data = loadData();

// 없앤 세부 목표 기능의 저장 내용을 기기에서 완전히 지움
if ("goals" in data) {
  delete data.goals;
  saveData();
}

// 그 날의 루틴 목록 = 그 날 기록의 checks 키. 기록이 없는 날은 기본 루틴을 보여줌
// 미리 추가한 루틴은 시작일 전에는 안 보이고, 앞으로의 날짜에서 지운 루틴은 그 날부터 안 보임
export function isRoutineActive(item, dateKey) {
  const dates = data.routineDates[item];
  if (!dates) return true;
  return (!dates.start || dates.start <= dateKey) && (!dates.end || dateKey < dates.end);
}

export function createDefaultEntry(dateKey) {
  const checks = {};
  const subs = {};
  data.items.filter((item) => isRoutineActive(item, dateKey)).forEach((item) => {
    checks[item] = false;
    subs[item] = {};
    (data.subItems[item] || []).forEach((sub) => { subs[item][sub] = false; });
  });
  return { checks: checks, subs: subs, memo: "" };
}

export function getEntry(dateKey) {
  if (!data[dateKey]) data[dateKey] = createDefaultEntry(dateKey);
  if (!data[dateKey].checks) data[dateKey].checks = {};
  if (!data[dateKey].subs) data[dateKey].subs = {};
  return data[dateKey];
}

// 세부 루틴이 있으면 전부 끝났을 때만 루틴도 완료로 봄. 세부 루틴을 고칠 때마다 맞춤
export function syncRoutineCheck(dateKey, item) {
  const entry = getEntry(dateKey);
  const subDone = Object.values(entry.subs[item] || {});
  if (subDone.length > 0) entry.checks[item] = subDone.every(Boolean);
}

// 루틴을 직접 체크하거나 풀면 세부 루틴도 전부 같이 맞춤. 위 규칙과 어긋나는 상태가 생기지 않게 함
export function setRoutineCheck(dateKey, item, checked) {
  const entry = getEntry(dateKey);
  entry.checks[item] = checked;
  const subs = entry.subs[item] || {};
  Object.keys(subs).forEach((sub) => { subs[sub] = checked; });
}

export function getRoutines(dateKey) {
  if (data[dateKey]) return Object.keys(data[dateKey].checks || {});
  return data.items.filter((item) => isRoutineActive(item, dateKey));
}

export function getPlans(dateKey) {
  return Object.keys((data[dateKey] && data[dateKey].plans) || {});
}

// 이미 기록이 있는 앞날짜(먼저 적어 둔 계획 등)에도 루틴 변경이 반영되도록 찾음
export function laterEntryKeys(dateKey) {
  return Object.keys(data).filter((key) => DATE_KEY_PATTERN.test(key) && key > dateKey);
}

// 지난 날짜는 그날 기록만 고치고, 오늘 이후 날짜는 그 날부터 계속 적용
export function addRoutine(dateKey, name) {
  if (dateKey >= todayKey) {
    const dates = data.routineDates[name] || {};
    if (!data.items.includes(name)) {
      data.items.push(name);
      dates.start = dateKey;
    } else if (dates.start && dateKey < dates.start) {
      dates.start = dateKey;
    }
    if (dates.end && dates.end <= dateKey) {
      delete dates.end;
      dates.start = dateKey;
    }
    data.routineDates[name] = dates;
    laterEntryKeys(dateKey).forEach((key) => {
      const entry = data[key];
      if (!entry.checks) entry.checks = {};
      if (name in entry.checks) return;
      entry.checks[name] = false;
      if (!entry.subs) entry.subs = {};
      entry.subs[name] = {};
      (data.subItems[name] || []).forEach((sub) => { entry.subs[name][sub] = false; });
    });
  }
  const entry = getEntry(dateKey);
  if (!(name in entry.checks)) entry.checks[name] = false;
}

export function removeRoutine(dateKey, name) {
  const entry = getEntry(dateKey);
  delete entry.checks[name];
  delete entry.subs[name];
  if (dateKey < todayKey) return;
  laterEntryKeys(dateKey).forEach((key) => {
    if (data[key].checks) delete data[key].checks[name];
    if (data[key].subs) delete data[key].subs[name];
  });
  if (dateKey > todayKey) {
    const dates = data.routineDates[name] || {};
    if (!dates.start || dates.start < dateKey) {
      data.routineDates[name] = { ...dates, end: dateKey };
      return;
    }
  }
  data.items = data.items.filter((i) => i !== name);
  delete data.subItems[name];
  delete data.routineDates[name];
}

export function getSubs(dateKey, item) {
  if (!data[dateKey]) return data.subItems[item] || [];
  return Object.keys((data[dateKey].subs || {})[item] || {});
}

export function dateKeys() {
  return Object.keys(data).filter((key) => DATE_KEY_PATTERN.test(key));
}

// 오늘 기록을 미리 만들어 둬야 달력의 완료 개수가 그날 기준으로 정확함
getEntry(todayKey);
