const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_RESET_HOUR = 5;

function getKSTDate(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

function applyDayReset(kstDate: Date): Date {
  if (kstDate.getUTCHours() < DAY_RESET_HOUR) {
    kstDate.setUTCDate(kstDate.getUTCDate() - 1);
  }
  return kstDate;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayKST(): string {
  return formatDate(applyDayReset(getKSTDate()));
}

export function getYesterdayKST(): string {
  const d = applyDayReset(getKSTDate());
  d.setUTCDate(d.getUTCDate() - 1);
  return formatDate(d);
}

export function getCurrentYearMonthKST(): { year: number; month: number } {
  const d = applyDayReset(getKSTDate());
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function getKSTTimestamp(): { date: string; time: string } {
  const d = getKSTDate();
  return {
    date: formatDate(d),
    time: d.toISOString().split('T')[1].split('.')[0],
  };
}
