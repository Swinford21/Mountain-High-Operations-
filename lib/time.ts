export const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || 'America/New_York'

/** Calendar date (YYYY-MM-DD) and 24h hour in the business time zone. */
export function zonedNow(date: Date = new Date(), tz: string = BUSINESS_TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export function todayLocal() {
  return zonedNow().date
}

export function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDateLong(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateShort(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatTime12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

/** Arrival window starting at `hhmm`, e.g. "8:00 AM – 9:00 AM". */
export function formatTimeWindow(hhmm: string, minutes = 60) {
  const [h, m] = hhmm.split(':').map(Number)
  const end = (h * 60 + (m || 0) + minutes) % (24 * 60)
  const endHHMM = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  return `${formatTime12(hhmm)} – ${formatTime12(endHHMM)}`
}

export function formatTimestamp(ts: Date | string | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    timeZone: BUSINESS_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatClock(ts: Date | string | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', {
    timeZone: BUSINESS_TZ,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Local date string (YYYY-MM-DD) for a timestamp in the business time zone. */
export function localDateOf(ts: Date | string) {
  return zonedNow(new Date(ts)).date
}

/** UTC instant for a wall-clock date + time in the business time zone. */
export function zonedToUtc(dateStr: string, hhmm: string, tz: string = BUSINESS_TZ) {
  const guess = new Date(`${dateStr}T${hhmm}:00Z`)
  const asLocal = new Date(guess.toLocaleString('en-US', { timeZone: tz }))
  const asUtc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(guess.getTime() + (asUtc.getTime() - asLocal.getTime()))
}

/** HH:MM wall-clock time in the business time zone, for <input type="time">. */
export function localTimeOf(ts: Date | string) {
  return new Date(ts).toLocaleTimeString('en-GB', {
    timeZone: BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

export function formatHours(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function formatMoney(cents: number | null | undefined) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
