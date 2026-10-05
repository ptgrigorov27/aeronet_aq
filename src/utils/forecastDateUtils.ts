/** UTC date helpers for forecast GeoJSON file naming and Forecast Date dropdown. */

export function formatYmdUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(d.getUTCDate()).padStart(2, "0")}`
  );
}

export function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** MM/DD/YYYY in UTC — used by Forecast Date dropdown labels. */
export function formatForecastLabel(d: Date): string {
  return (
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}/` +
    `${String(d.getUTCDate()).padStart(2, "0")}/` +
    `${d.getUTCFullYear()}`
  );
}

/** Day 1 = init, Day 2 = init+1, Day 3 = init+2 */
export function buildForecastDateOptions(initDate: Date): string[] {
  return [0, 1, 2].map((offset) => formatForecastLabel(addUtcDays(initDate, offset)));
}

/** Calendar day from DatePicker → stable UTC noon ISO (avoids TZ day-shift). */
export function utcNoonIsoFromParts(
  year: number,
  monthIndex: number,
  day: number
): string {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0)).toISOString();
}

export function utcNoonIsoFromDate(d: Date): string {
  return utcNoonIsoFromParts(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  );
}

export function ymdKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatYmdUTC(d);
}

export function ymdKeyFromDate(d: Date): string {
  return formatYmdUTC(d);
}
