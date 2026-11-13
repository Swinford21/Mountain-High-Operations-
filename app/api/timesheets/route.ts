import { NextResponse } from 'next/server'
import { getCurrentUser, isAdminRole } from '@/lib/session'
import { entryDurationMs, getEntriesBetween } from '@/lib/time-queries'
import { addDays, formatClock, localDateOf } from '@/lib/time'

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !isAdminRole(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const week = new URL(request.url).searchParams.get('week') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: 'Invalid week' }, { status: 400 })

  const entries = await getEntriesBetween(week, addDays(week, 7))
  const now = Date.now()
  const rows = [
    ['Date', 'Team member', 'Clock in', 'Clock out', 'Hours', 'Job', 'Notes'],
    ...entries
      .slice()
      .reverse()
      .map((e) => [
        localDateOf(e.clockIn),
        e.userName,
        formatClock(e.clockIn),
        e.clockOut ? formatClock(e.clockOut) : 'Still clocked in',
        (entryDurationMs(e, now) / 3600000).toFixed(2),
        e.jobTitle ?? 'Yard / general',
        e.notes ?? '',
      ]),
  ]
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="timesheets-${week}.csv"`,
    },
  })
}
