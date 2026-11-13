'use client'

import { useActionState, useState } from 'react'
import { Lock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { AddressInput } from '@/components/address-input'
import { CustomerPicker } from '@/components/jobs/customer-picker'
import { MaterialsEditor, type MaterialLine } from '@/components/jobs/materials-editor'
import type { Operation } from '@/lib/operations'
import { REPEAT_OPTIONS } from '@/lib/recurrence'
import { roleLabel } from '@/lib/session-roles'
import type { ActionState } from '@/app/actions/jobs'
import type {
  CrewOption,
  CustomerOption,
  ProductOption,
  SalespersonOption,
  TeamMember,
  TruckOption,
} from '@/lib/queries'
import { cn } from '@/lib/utils'

type JobDefaults = {
  customerId?: number
  operation?: string
  title?: string
  scheduledDate?: string
  startTime?: string
  durationMinutes?: number
  address?: string | null
  assignedTo?: string | null
  truckId?: number | null
  crewId?: number | null
  salespersonId?: string | null
  priceCents?: number | null
  description?: string | null
}

const DURATIONS = [30, 60, 90, 120, 180, 240, 360, 480]
const DEFAULT_DURATION = 60

export function JobForm({
  action,
  customers,
  team,
  trucks,
  crews,
  operations,
  products,
  salespeople = [],
  estimateId,
  initialItems = [],
  defaults,
  mode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  customers: CustomerOption[]
  team: TeamMember[]
  trucks: TruckOption[]
  crews: CrewOption[]
  operations: Operation[]
  products: ProductOption[]
  salespeople?: SalespersonOption[]
  /** Set when booking an approved estimate; the estimate moves to Scheduled once the job is saved. */
  estimateId?: number
  initialItems?: MaterialLine[]
  defaults: JobDefaults
  mode: 'create' | 'edit'
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [operation, setOperation] = useState(defaults.operation ?? operations[0]?.id ?? '')
  const [address, setAddress] = useState(defaults.address ?? '')
  const [title, setTitle] = useState(defaults.title ?? '')
  const [price, setPrice] = useState(defaults.priceCents != null ? (defaults.priceCents / 100).toFixed(2) : '')
  const [priceTouched, setPriceTouched] = useState(defaults.priceCents != null)
  const [truckId, setTruckId] = useState(defaults.truckId != null ? String(defaults.truckId) : '')
  const selectedTruck = trucks.find((t) => String(t.id) === truckId)
  const [crewId, setCrewId] = useState(defaults.crewId != null ? String(defaults.crewId) : '')
  const [assignedTo, setAssignedTo] = useState(defaults.assignedTo ?? '')
  const [repeat, setRepeat] = useState('none')

  function pickCrew(id: string) {
    setCrewId(id)
    const crew = crews.find((c) => String(c.id) === id)
    if (!crew) return
    if (crew.truckId && trucks.some((t) => t.id === crew.truckId)) setTruckId(String(crew.truckId))
    if (crew.leadUserId && !assignedTo && team.some((m) => m.id === crew.leadUserId)) setAssignedTo(crew.leadUserId)
  }

  const durationOptions = DURATIONS.includes(defaults.durationMinutes ?? DEFAULT_DURATION)
    ? DURATIONS
    : [...DURATIONS, defaults.durationMinutes!].sort((a, b) => a - b)

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {estimateId && <input type="hidden" name="estimateId" value={estimateId} />}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Operation</h2>
        <div role="radiogroup" aria-label="Operation" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {operations.map((op) => {
            const checked = operation === op.id
            return (
              <label
                key={op.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30',
                  checked ? 'border-foreground' : 'hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="operation"
                  value={op.id}
                  checked={checked}
                  onChange={() => setOperation(op.id)}
                  className="sr-only"
                />
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: op.color }} aria-hidden="true" />
                {op.singular}
              </label>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CustomerPicker
          customers={customers}
          defaultCustomerId={defaults.customerId}
          allowNew={mode === 'create'}
          onSelect={(c) => {
            if (c) setAddress(c.address ?? '')
          }}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Job title</Label>
          <Input
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 10 yds river rock, back yard"
            className="h-9"
          />
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="scheduledDate">Date</Label>
          <Input id="scheduledDate" name="scheduledDate" type="date" required defaultValue={defaults.scheduledDate} className="h-9" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startTime">Start time</Label>
          <Input id="startTime" name="startTime" type="time" required defaultValue={defaults.startTime ?? '08:00'} className="h-9" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="durationMinutes">Length</Label>
          <NativeSelect id="durationMinutes" name="durationMinutes" defaultValue={String(defaults.durationMinutes ?? DEFAULT_DURATION)}>
            {durationOptions.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} hr${m === 60 ? '' : 's'}`}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assignedTo">Assigned to</Label>
          <NativeSelect id="assignedTo" name="assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {roleLabel(m.role) ? ` — ${roleLabel(m.role)}` : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="crewId">Crew</Label>
          <NativeSelect id="crewId" name="crewId" value={crewId} onChange={(e) => pickCrew(e.target.value)}>
            <option value="">No crew</option>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="truckId" className="flex items-center gap-2">
            Truck
            {selectedTruck && (
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: selectedTruck.color }} aria-hidden="true" />
            )}
          </Label>
          <NativeSelect id="truckId" name="truckId" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
            <option value="">No truck</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </section>

      {mode === 'create' && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2 sm:w-56">
            <Label htmlFor="repeat">Repeat</Label>
            <NativeSelect id="repeat" name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {repeat !== 'none' && (
            <>
              <div className="flex flex-col gap-2 sm:w-40">
                <Label htmlFor="repeatCount">Number of visits</Label>
                <Input
                  id="repeatCount"
                  name="repeatCount"
                  type="number"
                  min={2}
                  max={52}
                  defaultValue={repeat === 'weekly' ? 12 : repeat === 'monthly' ? 6 : 4}
                  key={repeat}
                  className="h-9 tabular-nums"
                />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:pb-2">
                Each visit is added to the calendar as its own job with the same details and materials. Only the
                first visit sends a confirmation; every visit gets the day-before reminder.
              </p>
            </>
          )}
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="address">Job address</Label>
          <AddressInput
            id="address"
            name="address"
            value={address}
            onValueChange={setAddress}
            placeholder="Fills in from the customer — or start typing an address"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              setPriceTouched(true)
            }}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="salespersonId">Salesperson</Label>
          <NativeSelect id="salespersonId" name="salespersonId" defaultValue={defaults.salespersonId ?? ''}>
            <option value="">None</option>
            {salespeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {defaults.salespersonId && !salespeople.some((p) => p.id === defaults.salespersonId) && (
              <option value={defaults.salespersonId}>Former salesperson</option>
            )}
          </NativeSelect>
        </div>
      </section>

      <MaterialsEditor
        products={products}
        initial={initialItems}
        onTotalChange={(cents) => {
          if (!priceTouched) setPrice(cents ? (cents / 100).toFixed(2) : '')
        }}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Notes for customer</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaults.description ?? ''}
          placeholder="Anything the customer should see in their confirmation…"
        />
        <p className="text-sm text-muted-foreground">Included in the customer&apos;s confirmation email and text.</p>
      </div>

      {mode === 'create' && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <Label htmlFor="crewNote" className="flex items-center gap-2">
              <Users className="size-4" aria-hidden="true" />
              Crew notes
            </Label>
            <Textarea
              id="crewNote"
              name="crewNote"
              rows={3}
              maxLength={4000}
              placeholder="Gate code, where to dump, anything the crew should know…"
            />
            <p className="text-sm text-muted-foreground">
              Whole team can see these. Customers never do. The job title shows in red when there are crew notes.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <Label htmlFor="adminNote" className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden="true" />
              Admin notes
            </Label>
            <Textarea id="adminNote" name="adminNote" rows={3} maxLength={4000} placeholder="Private note for admins…" />
            <p className="text-sm text-muted-foreground">Admins only. Crew and customers never see these.</p>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="notifyCustomer"
            defaultChecked={mode === 'create'}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span className="flex flex-col">
            <span className="font-medium">
              {mode === 'create' ? 'Send confirmation email and text' : 'Send updated confirmation to customer'}
            </span>
            <span className="text-muted-foreground">They also get a reminder at 4pm the day before.</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-10 px-5">
            {pending ? 'Saving…' : mode === 'create' ? 'Schedule job' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}
