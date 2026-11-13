'use client'

import { useActionState, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormError, useActionToast } from '@/components/action-feedback'
import { saveCrew } from '@/app/actions/settings'

export type CrewData = {
  id: number
  name: string
  leadUserId: string | null
  truckId: number | null
  notes: string | null
  active: boolean
  memberIds: string[]
}

export function CrewDialog({
  crew,
  team,
  trucks,
}: {
  crew?: CrewData
  team: { id: string; name: string; role: string }[]
  trucks: { id: number; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(saveCrew.bind(null, crew?.id ?? null), null)
  const [lead, setLead] = useState(crew?.leadUserId ?? '')
  useActionToast(state, () => setOpen(false))
  const idp = crew ? `crew-${crew.id}` : 'crew-new'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          crew ? <Button variant="ghost" size="icon-sm" aria-label={`Edit ${crew.name}`} /> : <Button className="h-9" />
        }
      >
        {crew ? (
          <Pencil aria-hidden="true" />
        ) : (
          <>
            <Plus aria-hidden="true" />
            New crew
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{crew ? `Edit ${crew.name}` : 'Create a crew'}</DialogTitle>
          <DialogDescription>Group team members so you can schedule them together on a job.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idp}-name`}>Crew name</Label>
            <Input id={`${idp}-name`} name="name" required maxLength={60} defaultValue={crew?.name} placeholder="e.g. Install Crew A" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idp}-lead`}>Crew lead</Label>
              <NativeSelect id={`${idp}-lead`} name="leadUserId" value={lead} onChange={(e) => setLead(e.target.value)}>
                <option value="">No lead</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idp}-truck`}>Usual truck</Label>
              <NativeSelect id={`${idp}-truck`} name="truckId" defaultValue={crew?.truckId ? String(crew.truckId) : ''}>
                <option value="">No truck</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Members</legend>
            {team.length === 0 ? (
              <p className="text-sm text-muted-foreground">Approve team members on the Team page first.</p>
            ) : (
              <div className="grid max-h-52 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {team.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      name="members"
                      value={m.id}
                      defaultChecked={crew?.memberIds.includes(m.id) || m.id === lead}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idp}-notes`}>Notes</Label>
            <Textarea id={`${idp}-notes`} name="notes" rows={2} maxLength={2000} defaultValue={crew?.notes ?? ''} />
          </div>
          {crew && (
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="active" defaultChecked={crew.active} className="size-4 accent-[var(--primary)]" />
              Active (shows in the job form)
            </label>
          )}
          <DialogFooter className="items-center">
            <FormError state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : crew ? 'Save crew' : 'Create crew'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
