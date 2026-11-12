import { NextResponse } from 'next/server'
import { sendTomorrowReminders } from '@/lib/job-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Vercel Cron calls this at 20:00 and 21:00 UTC so that exactly one run lands on
// 4pm Eastern (Marietta, GA) in both daylight and standard time. Runs at any
// other local hour exit without sending.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await sendTomorrowReminders({ onlyAtReminderHour: true })
  return NextResponse.json(result)
}
