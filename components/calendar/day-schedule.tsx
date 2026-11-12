'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { rescheduleJobTime } from '@/app/actions/jobs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PaidMark } from '@/components/jobs/job-card'
import { jobColor } from '@/lib/operations'
import type { JobListItem } from '@/lib/queries'
import { formatDateLong, formatMoney, formatTime12 } from '@/lib/time'
import { cn } from '@/lib/utils'

const SLOT_MINUTES = 30
const DEFAULT_START = 6 * 60
const DEFAULT_END = 19 * 60

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const slotOf = (hhmm: string) => toHHMM(Math.floor(toMinutes(hhmm) / SLOT_MINUTES) * SLOT_MINUTES)

type PendingMove = { job: JobListItem; time: string }

export function DaySchedule({ day, jobs, isAdmin }: { day: string; jobs: JobListItem[]; isAdmin: boolean }) {
  const [optimisticJobs, moveOptimistic] = useOptimistic(jobs, (state, move: { id: number; time: string }) =>
    state.map((j) => (j.id === move.id ? { ...j, startTime: move.time } : j)),
  )
  const [activeJob, setActiveJob] = useState<JobListItem | null>(null)
  const [pending, setPending] = useState<PendingMove | null>(null)
  const [notify, setNotify] = useState(false)
  const [isSaving, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )

  const times = optimisticJobs.map((j) => toMinutes(j.startTime))
  const start = Math.min(DEFAULT_START, ...times.map((t) => Math.floor(t / SLOT_MINUTES) * SLOT_MINUTES))
  const end = Math.max(DEFAULT_END, ...times)
  const slots: string[] = []
  for (let t = start; t <= end; t += SLOT_MINUTES) slots.push(toHHMM(t))

  const bySlot = new Map<string, JobListItem[]>()
  for (const j of optimisticJobs) {
    const key = slotOf(j.startTime)
    bySlot.set(key, [...(bySlot.get(key) ?? []), j])
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveJob(optimisticJobs.find((j) => j.id === e.active.id) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveJob(null)
    const job = optimisticJobs.find((j) => j.id === e.active.id)
    const time = e.over?.id
    if (!job || typeof time !== 'string' || slotOf(job.startTime) === time) return
    setNotify(false)
    setPending({ job, time })
  }

  function confirmMove() {
    if (!pending) return
    const { job, time } = pending
    setPending(null)
    startTransition(async () => {
      moveOptimistic({ id: job.id, time })
      const result = await rescheduleJobTime(job.id, time, notify)
      if (result?.ok) toast.success(result.message)
      else toast.error(result?.message ?? 'Could not change the time')
    })
  }

  return (
    <>
      <DndContext id={`day-schedule-${day}`} sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveJob(null)}>
        {isAdmin && optimisticJobs.length > 0 && (
          <p className="text-xs text-muted-foreground">Drag a job by its handle to a new time slot.</p>
        )}
        <ol className="flex flex-col overflow-hidden rounded-lg border bg-card" aria-busy={isSaving}>
          {slots.map((slot) => (
            <TimeSlot key={slot} time={slot} jobs={bySlot.get(slot) ?? []} isAdmin={isAdmin} draggingId={activeJob?.id} />
          ))}
        </ol>
        <DragOverlay>{activeJob && <JobItem job={activeJob} isAdmin={isAdmin} overlay />}</DragOverlay>
      </DndContext>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change job time?</DialogTitle>
            <DialogDescription>
              {pending && (
                <>
                  <span className="font-medium text-foreground">{pending.job.title}</span> for {pending.job.customerName} on{' '}
                  {formatDateLong(day)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/40 p-3 font-mono text-sm tabular-nums">
              <span className="text-muted-foreground line-through">{formatTime12(pending.job.startTime)}</span>
              <span aria-hidden="true">{'→'}</span>
              <span className="sr-only">to</span>
              <span className="font-semibold">{formatTime12(pending.time)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="notify-time-change" checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
            <Label htmlFor="notify-time-change" className="font-normal">
              Send the customer an updated confirmation
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirmMove}>Change time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TimeSlot({
  time,
  jobs,
  isAdmin,
  draggingId,
}: {
  time: string
  jobs: JobListItem[]
  isAdmin: boolean
  draggingId?: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: time, disabled: !isAdmin })
  const onHour = time.endsWith(':00')
  return (
    <li
      ref={setNodeRef}
      className={cn(
        'flex min-h-9 gap-3 border-t px-2 py-1 transition-colors first:border-t-0',
        !onHour && 'border-dashed',
        isOver && 'bg-accent/30',
      )}
    >
      <span
        className={cn(
          'w-14 shrink-0 pt-1 text-right font-mono text-xs tabular-nums',
          onHour ? 'text-foreground' : 'text-muted-foreground/70',
        )}
      >
        {formatTime12(time)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {jobs.map((j) => (
          <DraggableJob key={j.id} job={j} isAdmin={isAdmin} hidden={draggingId === j.id} />
        ))}
      </div>
    </li>
  )
}

function DraggableJob({ job, isAdmin, hidden }: { job: JobListItem; isAdmin: boolean; hidden: boolean }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id: job.id, disabled: !isAdmin })
  return (
    <div ref={setNodeRef} className={cn(hidden && 'opacity-30')}>
      <JobItem
        job={job}
        isAdmin={isAdmin}
        handle={
          isAdmin && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
              aria-label={`Move ${job.title}, currently ${formatTime12(job.startTime)}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
          )
        }
      />
    </div>
  )
}

function JobItem({
  job,
  isAdmin,
  handle,
  overlay = false,
}: {
  job: JobListItem
  isAdmin: boolean
  handle?: React.ReactNode
  overlay?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-stretch gap-1 rounded-md border border-foreground/70 bg-background',
        overlay && 'cursor-grabbing shadow-lg ring-2 ring-foreground/20',
        job.status === 'completed' && 'opacity-70',
      )}
    >
      {handle}
      {overlay && isAdmin && (
        <span className="flex w-6 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
          <GripVertical className="size-4" />
        </span>
      )}
      <span className="my-1.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: jobColor(job) }} aria-hidden="true" />
      <Link href={`/jobs/${job.id}`} className="group flex min-w-0 flex-1 flex-col px-2 py-1.5 text-sm">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium group-hover:underline">{job.title}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {isAdmin && job.priceCents != null && (
              <span className="font-mono text-xs tabular-nums">{formatMoney(job.priceCents)}</span>
            )}
            {job.paymentStatus === 'paid' && <PaidMark />}
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{formatTime12(job.startTime)}</span> · {job.customerName}
          {job.truckName ? ` · ${job.truckName}` : ''}
          {job.assigneeName ? ` · ${job.assigneeName}` : ''}
        </span>
      </Link>
    </div>
  )
}
