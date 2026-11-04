// 오늘의 문구: 문구는 data/quotes.json에 두고, 여기서는 읽어서 고르기만 함
export function pickQuoteForDate(quotes, dateKey) {
  // 날짜로 고르므로 저장이나 동기화 없이도 하루 동안, 그리고 어느 기기에서나 같은 문구가 나옴
  const [y, m, d] = dateKey.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return quotes[dayNumber % quotes.length];
}

// 문구를 못 읽어도 앱은 계속 쓸 수 있어야 하므로, 실패하면 문구 칸만 숨긴 채로 둠
export async function showQuoteOfTheDay(dateKey) {
  const box = document.getElementById("quoteBox");
  const text = document.getElementById("quoteText");
  const source = document.getElementById("quoteSource");
  if (!box || !text || !source) return;
  try {
    const response = await fetch("./data/quotes.json");
    if (!response.ok) return;
    const quote = pickQuoteForDate(await response.json(), dateKey);
    text.textContent = quote.text;
    source.textContent = quote.author + ", 『" + quote.source + "』";
    box.hidden = false;
  } catch (e) {
    // 문구 칸은 숨긴 채로 둠
  }
}
