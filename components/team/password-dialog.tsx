'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { setUserPassword } from '@/app/actions/admin'

export function PasswordDialog({ userId, name, isSelf }: { userId: string; name: string; isSelf: boolean }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset(next: boolean) {
    setOpen(next)
    if (!next) {
      setPassword('')
      setConfirm('')
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Change password for ${name}`} />}>
        <KeyRound aria-hidden="true" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            {isSelf
              ? 'Set a new password for your account.'
              : `Set a new password for ${name}. They'll be signed out and can sign in with the new password. Share it with them privately.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (password !== confirm) {
              setError("Passwords don't match")
              return
            }
            setError(null)
            startTransition(async () => {
              const r = await setUserPassword(userId, password)
              if (r?.ok) {
                toast.success(r.message)
                reset(false)
              } else setError(r?.message ?? 'Could not change password')
            })
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`pw-${userId}`}>New password</Label>
            <Input
              id={`pw-${userId}`}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`pw2-${userId}`}>Confirm new password</Label>
            <Input
              id={`pw2-${userId}`}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <DialogFooter className="items-center">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Change password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
