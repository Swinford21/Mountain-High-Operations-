'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { clockIn, clockOut, switchJob } from '@/app/actions/time'

type JobOption = { id: number; label: string }

function elapsed(fromIso: string, now: number) {
  const ms = Math.max(0, now - new Date(fromIso).getTime())
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ClockCard({
  openEntry,
  jobOptions,
  todayTotalLabel,
}: {
  openEntry: { clockInIso: string; clockInLabel: string; jobId: number | null } | null
  jobOptions: JobOption[]
  todayTotalLabel: string
}) {
  const [pending, startTransition] = useTransition()
  const [jobId, setJobId] = useState<string>(openEntry?.jobId ? String(openEntry.jobId) : '')
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!openEntry) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [openEntry])

  function run(fn: () => Promise<{ ok: boolean; message: string } | null>) {
    startTransition(async () => {
      const result = await fn()
      if (result) (result.ok ? toast.success : toast.error)(result.message)
    })
  }

  const clockedIn = !!openEntry

  return (
    <section
      aria-label="Time clock"
      className="flex flex-col gap-5 rounded-xl bg-sidebar p-5 text-sidebar-foreground sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-sidebar-primary uppercase">
            <Timer className="size-3.5" aria-hidden="true" />
            {clockedIn ? 'On the clock' : 'Off the clock'}
          </p>
          <p className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl" aria-live="polite">
            {clockedIn ? (now ? elapsed(openEntry.clockInIso, now) : '0:00:00') : todayTotalLabel}
          </p>
          <p className="text-sm text-sidebar-foreground/70">
            {clockedIn ? `Since ${openEntry.clockInLabel}` : 'Worked today'}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`mt-1 size-3 rounded-full ${clockedIn ? 'animate-pulse bg-sidebar-primary' : 'bg-sidebar-foreground/30'}`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="clock-job" className="text-sidebar-foreground/80">
          Job (optional)
        </Label>
        <NativeSelect
          id="clock-job"
          value={jobId}
          onChange={(e) => {
            setJobId(e.target.value)
            if (clockedIn) run(() => switchJob(e.target.value ? Number(e.target.value) : null))
          }}
          disabled={pending}
          className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
        >
          <option value="">Yard / general work</option>
          {jobOptions.map((j) => (
            <option key={j.id} value={j.id}>
              {j.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {clockedIn ? (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => clockOut())}
          className="h-14 bg-sidebar-foreground text-base font-semibold text-sidebar hover:bg-sidebar-foreground/90"
        >
          {pending ? 'Working…' : 'Clock out'}
        </Button>
      ) : (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => clockIn(jobId ? Number(jobId) : null))}
          className="h-14 bg-sidebar-primary text-base font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
        >
          {pending ? 'Working…' : 'Clock in'}
        </Button>
      )}
    </section>
  )
}
