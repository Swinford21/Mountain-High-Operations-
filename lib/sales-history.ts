/**
 * Monthly totals from the "Total Sales Tracker" section of each month tab in
 * data/MHM-Total-Sales-2026-38fc49.xlsx. Each tab lists the prior-year figures
 * it compares against, so every month is a like-for-like comparison.
 * August uses the "NEW AUGUST 2026" tab.
 */
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const YEARS = [2026, 2025, 2024, 2023] as const
export type Year = (typeof YEARS)[number]

export const MONTHLY_SALES: Record<Year, (number | null)[]> = {
  2026: [169300, 251805, 502445, 602602, 564753, 470808, 322127, 225786, 168944, 144513, null, null],
  2025: [257799, 385623, 708545, 815263, 739770, 553392, 504098, 198676, 189173, 176119, 160546, 157116],
  2024: [217889, 352995, 544978, 650834, 619802, 471497, 297162, 197668, 162593, 201051, 184771, 122477],
  2023: [199692, 242232, 433313, 470423, 532315, 331623, 244541, 207308, 194303, 143998, 167033, 192374],
}

/** November 2026 is in progress: weeks 1–3 of the tracker against the same weeks in prior years. */
export const NOVEMBER_TO_DATE: Record<Year, number> = {
  2026: 16860,
  2025: 6586 + 37302 + 42512,
  2024: 11458 + 38308 + 34173,
  2023: 19225 + 46085 + 43112,
}

export const LAST_FULL_MONTH = 9 // October, zero-based

export const YEAR_COLORS: Record<Year, string> = {
  2026: 'var(--brand-red)',
  2025: 'var(--primary)',
  2024: 'var(--brand-teal)',
  2023: 'var(--brand-gold)',
}

export function yearToDate(year: Year, throughMonth = LAST_FULL_MONTH) {
  return MONTHLY_SALES[year].slice(0, throughMonth + 1).reduce<number>((s, v) => s + (v ?? 0), 0)
}

export function pctChange(current: number, previous: number) {
  return previous ? (current - previous) / previous : 0
}
