/* India FY runs Apr–Mar. currentFY() returns the starting calendar year of the
   FY we're currently inside (e.g. on Aug 2026 → returns 2026, meaning FY26-27). */

export const currentFY = () => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

export function fyLabel(year, lastActualYear) {
  if (year <= lastActualYear) return `FY${String(year).slice(2)}A`;
  return `FY${String(year).slice(2)}E`;
}
