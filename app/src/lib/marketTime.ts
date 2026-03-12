function getCnTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((item) => item.type === 'weekday')?.value || 'Mon';
  const hour = Number(parts.find((item) => item.type === 'hour')?.value || '0');
  const minute = Number(parts.find((item) => item.type === 'minute')?.value || '0');

  return { weekday, hour, minute };
}

export function isCnMarketTradingSession(now = new Date()): boolean {
  const { weekday, hour, minute } = getCnTimeParts(now);

  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  const totalMinutes = hour * 60 + minute;
  const inMorning = totalMinutes >= 9 * 60 + 30 && totalMinutes < 11 * 60 + 30;
  const inAfternoon = totalMinutes >= 13 * 60 && totalMinutes < 15 * 60;

  return inMorning || inAfternoon;
}

export function getStockDetailRefreshInterval(now = new Date()): number {
  return isCnMarketTradingSession(now) ? 5_000 : 60_000;
}
