'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Mail, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { sendCampaign, sendTestCampaign } from '@/app/actions/marketing'
import { cn } from '@/lib/utils'

type Channel = 'email' | 'sms' | 'both'

const CHANNELS: { id: Channel; label: string; icon: typeof Mail }[] = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'Text', icon: MessageSquare },
  { id: 'both', label: 'Both', icon: Send },
]

export function CampaignComposer({
  audiences,
  counts,
}: {
  audiences: readonly { id: string; label: string }[]
  counts: Record<string, { email: number; sms: number }>
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [channel, setChannel] = useState<Channel>('email')
  const [audience, setAudience] = useState('all')
  const [body, setBody] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendState, sendAction, sending] = useActionState(sendCampaign, null)
  const [testState, testAction, testing] = useActionState(sendTestCampaign, null)

  useEffect(() => {
    if (!sendState) return
    ;(sendState.ok ? toast.success : toast.error)(sendState.message)
    if (sendState.ok) {
      formRef.current?.reset()
      setBody('')
      setConfirmOpen(false)
    }
  }, [sendState])
  useEffect(() => {
    if (testState) (testState.ok ? toast.success : toast.error)(testState.message)
  }, [testState])

  const c = counts[audience] ?? { email: 0, sms: 0 }
  const reach = channel === 'email' ? c.email : channel === 'sms' ? c.sms : c.email + c.sms
  const smsLength = body.length + 'Mountain High Landscape Supply: '.length + ' Reply STOP to opt out.'.length
  const segments = Math.ceil(smsLength / 153)

  return (
    <form ref={formRef} action={sendAction} className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="font-display text-2xl font-extrabold tracking-wide uppercase">New campaign</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="m-name">Campaign name (internal)</Label>
        <Input id="m-name" name="name" required placeholder="Spring mulch sale" className="h-9" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Send as</legend>
        <input type="hidden" name="channel" value={channel} />
        <div role="radiogroup" aria-label="Channel" className="grid grid-cols-3 gap-2">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon
            return (
              <button
                key={ch.id}
                type="button"
                role="radio"
                aria-checked={channel === ch.id}
                onClick={() => setChannel(ch.id)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium',
                  channel === ch.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {ch.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="m-audience">Audience</Label>
        <NativeSelect id="m-audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {audiences.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">
          {channel !== 'sms' && `${c.email} opted-in email${c.email === 1 ? '' : 's'}`}
          {channel === 'both' && ' · '}
          {channel !== 'email' && `${c.sms} opted-in phone${c.sms === 1 ? '' : 's'}`}
        </p>
      </div>

      {channel !== 'sms' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-subject">Email subject</Label>
          <Input id="m-subject" name="subject" required placeholder="20% off river rock this weekend" className="h-9" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="m-body">Message</Label>
        <Textarea
          id="m-body"
          name="body"
          required
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'Hi {{first_name}},\n\nSpring is here — stock up on premium mulch and get free delivery on orders of 10+ yards through Sunday.'}
        />
        <p className="text-sm text-muted-foreground">
          Use {'{{first_name}}'} to personalize.
          {channel !== 'email' &&
            ` Text: ${smsLength} characters (${segments} segment${segments === 1 ? '' : 's'}), "Reply STOP to opt out" added automatically.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Button type="submit" variant="outline" formAction={testAction} disabled={testing || channel === 'sms'}>
          {testing ? 'Sending test…' : 'Send test to me'}
        </Button>
        <Button
          type="button"
          disabled={sending || reach === 0}
          onClick={() => {
            if (formRef.current?.reportValidity()) setConfirmOpen(true)
          }}
        >
          <Send aria-hidden="true" />
          Send to {reach.toLocaleString()}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this campaign now?</DialogTitle>
            <DialogDescription>
              It goes out immediately to {reach.toLocaleString()} recipient{reach === 1 ? '' : 's'} and can&apos;t be
              recalled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Not yet</DialogClose>
            <Button type="button" disabled={sending} onClick={() => formRef.current?.requestSubmit()}>
              {sending ? 'Sending…' : 'Send campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
