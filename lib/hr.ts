import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { todayLocal } from '@/lib/time'

export type Milestone = {
  employeeId: number
  name: string
  kind: 'birthday' | 'anniversary'
  /** Next occurrence, YYYY-MM-DD. */
  date: string
  daysAway: number
  /** Age turning (birthday) or years of service (anniversary). */
  years: number
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Next yearly occurrence of a date on/after `today`. Feb 29 falls on Feb 28 in non-leap years. */
function nextOccurrence(original: string, today: string) {
  const [, m, d] = original.split('-').map(Number)
  const year = Number(today.slice(0, 4))
  const build = (y: number) => {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
  }
  const thisYear = build(year)
  return thisYear >= today ? thisYear : build(year + 1)
}

export function upcomingMilestones(
  people: { id: number; name: string; birthDate: string | null; hireDate: string | null }[],
  withinDays: number,
  today = todayLocal(),
): Milestone[] {
  const out: Milestone[] = []
  for (const p of people) {
    for (const [kind, original] of [
      ['birthday', p.birthDate],
      ['anniversary', p.hireDate],
    ] as const) {
      if (!original) continue
      const date = nextOccurrence(original, today)
      const years = Number(date.slice(0, 4)) - Number(original.slice(0, 4))
      // A hire date this year isn't an anniversary yet.
      if (kind === 'anniversary' && years < 1) continue
      const daysAway = daysBetween(today, date)
      if (daysAway <= withinDays) out.push({ employeeId: p.id, name: p.name, kind, date, daysAway, years })
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name))
}

export async function getUpcomingMilestones(withinDays: number) {
  const people = await db
    .select({ id: employees.id, name: employees.name, birthDate: employees.birthDate, hireDate: employees.hireDate })
    .from(employees)
    .where(eq(employees.status, 'active'))
  return upcomingMilestones(people, withinDays)
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export function milestoneLabel(m: Milestone) {
  return m.kind === 'birthday' ? `Birthday${m.years > 0 ? ` (turns ${m.years})` : ''}` : `${ordinal(m.years)} work anniversary`
}

export function whenLabel(daysAway: number) {
  if (daysAway === 0) return 'Today'
  if (daysAway === 1) return 'Tomorrow'
  return `In ${daysAway} days`
}

export function tenureLabel(hireDate: string | null, today = todayLocal()) {
  if (!hireDate) return null
  const months =
    (Number(today.slice(0, 4)) - Number(hireDate.slice(0, 4))) * 12 +
    (Number(today.slice(5, 7)) - Number(hireDate.slice(5, 7))) -
    (Number(today.slice(8, 10)) < Number(hireDate.slice(8, 10)) ? 1 : 0)
  if (months < 1) return 'New this month'
  const y = Math.floor(months / 12)
  const mo = months % 12
  return [y && `${y} yr${y === 1 ? '' : 's'}`, mo && `${mo} mo`].filter(Boolean).join(' ')
}
