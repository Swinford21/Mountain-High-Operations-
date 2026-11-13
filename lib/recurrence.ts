export const REPEAT_OPTIONS = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' },
  { id: 'quarterly', label: 'Every 3 months' },
] as const

export type RepeatRule = (typeof REPEAT_OPTIONS)[number]['id']

export function repeatLabel(rule: string | null | undefined) {
  return REPEAT_OPTIONS.find((o) => o.id === rule)?.label ?? null
}

function addMonthsClamped(start: string, months: number) {
  const [y, m, d] = start.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * All visit dates for a repeating job, starting with `start`. Each date is computed from the start
 * so a job on the 31st lands on the last day of shorter months and returns to the 31st afterwards.
 */
export function repeatDates(start: string, rule: RepeatRule, count: number): string[] {
  if (rule === 'none') return [start]
  return Array.from({ length: count }, (_, i) => {
    if (rule === 'weekly') {
      const t = new Date(`${start}T12:00:00Z`)
      t.setUTCDate(t.getUTCDate() + 7 * i)
      return t.toISOString().slice(0, 10)
    }
    return addMonthsClamped(start, i * (rule === 'monthly' ? 1 : 3))
  })
}
