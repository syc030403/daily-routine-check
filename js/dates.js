// 날짜 계산: 날짜 키는 기기 로컬 시간 기준 YYYY-MM-DD 문자열이라 크기 비교로 앞뒤를 판단할 수 있음
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 기기 로컬 시간 기준 YYYY-MM-DD
export function toDateKey(y, monthIndex, day) {
  return y + "-" + String(monthIndex + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

export function getWeekdayLabel(dateKey) {
  return WEEKDAYS[new Date(dateKey + "T00:00:00").getDay()];
}

export const now = new Date();
export const todayKey = toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
