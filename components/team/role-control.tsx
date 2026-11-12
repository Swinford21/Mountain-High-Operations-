'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { setUserRole } from '@/app/actions/admin'

export function RoleControl({ userId, role, isSelf }: { userId: string; role: string; isSelf: boolean }) {
  const [pending, startTransition] = useTransition()
  const run = (next: string) =>
    startTransition(async () => {
      const r = await setUserRole(userId, next)
      if (r) (r.ok ? toast.success : toast.error)(r.message)
    })

  if (role === 'pending') {
    return (
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => run('crew')}>
          Approve as crew
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run('admin')}>
          Approve as admin
        </Button>
      </div>
    )
  }

  return (
    <div className="w-40">
      <label htmlFor={`role-${userId}`} className="sr-only">
        Role
      </label>
      <NativeSelect id={`role-${userId}`} value={role} disabled={pending || isSelf} onChange={(e) => run(e.target.value)}>
        <option value="admin">Admin</option>
        <option value="crew">Crew</option>
        <option value="pending">Remove access</option>
      </NativeSelect>
    </div>
  )
}
