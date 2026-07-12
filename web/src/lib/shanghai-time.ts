const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiDayBounds(now: Date): { start: Date; end: Date } {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = new Map(dateParts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  const start = new Date(Date.UTC(year, month - 1, day) - SHANGHAI_UTC_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}
