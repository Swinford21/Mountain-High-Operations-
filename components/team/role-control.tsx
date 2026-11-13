'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { setUserRole } from '@/app/actions/admin'

export function RoleControl({
  userId,
  role,
  isSelf,
  viewerIsOwner,
}: {
  userId: string
  role: string
  isSelf: boolean
  viewerIsOwner: boolean
}) {
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

  // Only owners can change an owner's role or make someone an owner.
  const locked = isSelf || (role === 'owner' && !viewerIsOwner)

  return (
    <div className="w-40">
      <label htmlFor={`role-${userId}`} className="sr-only">
        Role
      </label>
      <NativeSelect id={`role-${userId}`} value={role} disabled={pending || locked} onChange={(e) => run(e.target.value)}>
        {(viewerIsOwner || role === 'owner') && <option value="owner">Owner</option>}
        <option value="admin">Admin</option>
        <option value="crew">Crew</option>
        <option value="pending">Remove access</option>
      </NativeSelect>
    </div>
  )
}
