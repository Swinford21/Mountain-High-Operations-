'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { NativeSelect } from '@/components/ui/native-select'
import { setUserRole } from '@/app/actions/admin'
import { ASSIGNABLE_ROLES } from '@/lib/session-roles'

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

  // Only owners can change an owner's access or make someone an owner.
  const locked = isSelf || (role === 'owner' && !viewerIsOwner)
  const value = role === 'crew' ? 'installer' : role
  const options = ASSIGNABLE_ROLES.filter((r) => r.id !== 'owner' || viewerIsOwner || role === 'owner')

  return (
    <div className="w-44">
      <label htmlFor={`role-${userId}`} className="sr-only">
        Access
      </label>
      <NativeSelect id={`role-${userId}`} value={value} disabled={pending || locked} onChange={(e) => run(e.target.value)}>
        {role === 'pending' && (
          <option value="pending" disabled>
            Approve as…
          </option>
        )}
        {options.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
        {role !== 'pending' && <option value="pending">Remove access</option>}
      </NativeSelect>
    </div>
  )
}
