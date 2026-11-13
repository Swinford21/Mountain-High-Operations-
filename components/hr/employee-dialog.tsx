'use client'

import { useActionState, useState } from 'react'
import { Pencil, UserPlus } from 'lucide-react'
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
import { saveEmployee } from '@/app/actions/hr'
import type { Employee } from '@/lib/db/schema'

type Login = { id: string; name: string; email: string }

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export function EmployeeDialog({ employee, logins }: { employee?: Employee; logins: Login[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(saveEmployee.bind(null, employee?.id ?? null), null)
  const [status, setStatus] = useState(employee?.status ?? 'active')
  const [name, setName] = useState(employee?.name ?? '')
  const [email, setEmail] = useState(employee?.email ?? '')
  useActionToast(state, () => setOpen(false))
  const p = employee ? `emp-${employee.id}` : 'emp-new'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          employee ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${employee.name}`} />
          ) : (
            <Button className="h-9" />
          )
        }
      >
        {employee ? (
          <Pencil aria-hidden="true" />
        ) : (
          <>
            <UserPlus aria-hidden="true" />
            Add employee
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? employee.name : 'Add an employee'}</DialogTitle>
          <DialogDescription>Hire info is visible to admins only.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-6">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">Employee</legend>
            <Field id={`${p}-name`} label="Full name">
              <Input id={`${p}-name`} name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field id={`${p}-position`} label="Position">
              <Input id={`${p}-position`} name="position" maxLength={120} defaultValue={employee?.position ?? ''} placeholder="e.g. Crew Lead" />
            </Field>
            <Field id={`${p}-phone`} label="Phone">
              <Input id={`${p}-phone`} name="phone" type="tel" maxLength={40} defaultValue={employee?.phone ?? ''} />
            </Field>
            <Field id={`${p}-email`} label="Email">
              <Input id={`${p}-email`} name="email" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field id={`${p}-address`} label="Home address">
                <Input id={`${p}-address`} name="address" maxLength={300} defaultValue={employee?.address ?? ''} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id={`${p}-user`} label="App login">
                <NativeSelect
                  id={`${p}-user`}
                  name="userId"
                  defaultValue={employee?.userId ?? ''}
                  onChange={(e) => {
                    const login = logins.find((l) => l.id === e.target.value)
                    if (!login) return
                    if (!name) setName(login.name)
                    if (!email) setEmail(login.email)
                  }}
                >
                  <option value="">Not linked</option>
                  {logins.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.email})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="mb-3 text-sm font-semibold">Hire info</legend>
            <Field id={`${p}-hire`} label="Hire date">
              <Input id={`${p}-hire`} name="hireDate" type="date" defaultValue={employee?.hireDate ?? ''} />
            </Field>
            <Field id={`${p}-birth`} label="Birthday">
              <Input id={`${p}-birth`} name="birthDate" type="date" defaultValue={employee?.birthDate ?? ''} />
            </Field>
            <Field id={`${p}-paytype`} label="Pay type">
              <NativeSelect id={`${p}-paytype`} name="payType" defaultValue={employee?.payType ?? ''}>
                <option value="">Not set</option>
                <option value="hourly">Hourly</option>
                <option value="salary">Salary (yearly)</option>
              </NativeSelect>
            </Field>
            <Field id={`${p}-rate`} label="Pay rate (USD)">
              <Input
                id={`${p}-rate`}
                name="payRate"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={employee?.payRateCents != null ? (employee.payRateCents / 100).toFixed(2) : ''}
                className="tabular-nums"
              />
            </Field>
            <Field id={`${p}-status`} label="Status">
              <NativeSelect id={`${p}-status`} name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">No longer employed</option>
              </NativeSelect>
            </Field>
            {status === 'inactive' && (
              <Field id={`${p}-term`} label="Last day">
                <Input id={`${p}-term`} name="terminationDate" type="date" defaultValue={employee?.terminationDate ?? ''} />
              </Field>
            )}
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">Emergency contact</legend>
            <Field id={`${p}-ecname`} label="Name">
              <Input id={`${p}-ecname`} name="emergencyContactName" maxLength={120} defaultValue={employee?.emergencyContactName ?? ''} />
            </Field>
            <Field id={`${p}-ecphone`} label="Phone">
              <Input
                id={`${p}-ecphone`}
                name="emergencyContactPhone"
                type="tel"
                maxLength={40}
                defaultValue={employee?.emergencyContactPhone ?? ''}
              />
            </Field>
          </fieldset>

          <Field id={`${p}-notes`} label="HR notes">
            <Textarea
              id={`${p}-notes`}
              name="notes"
              rows={3}
              maxLength={4000}
              defaultValue={employee?.notes ?? ''}
              placeholder="Certifications, license class, shirt size, anything to keep on file…"
            />
          </Field>

          <DialogFooter className="items-center">
            <FormError state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : employee ? 'Save' : 'Add employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
