'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, CreditCard, Link2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { chargeJobCard, createJobPaymentLink, refreshJobPayments } from '@/app/actions/square-payments'

type SquareCard = {
  attach: (target: HTMLElement) => Promise<void>
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>
  destroy: () => Promise<boolean>
}
type SquarePayments = { card: () => Promise<SquareCard> }

declare global {
  interface Window {
    Square?: { payments: (applicationId: string, locationId: string) => SquarePayments }
  }
}

let squareScript: Promise<void> | null = null
function loadSquareJs(sandbox: boolean) {
  if (window.Square) return Promise.resolve()
  squareScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = sandbox ? 'https://sandbox.web.squarecdn.com/v1/square.js' : 'https://web.squarecdn.com/v1/square.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      squareScript = null
      reject(new Error('Could not load the Square card form'))
    }
    document.head.appendChild(script)
  })
  return squareScript
}

function toCents(value: string) {
  const n = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

type Props = {
  jobId: number
  balanceCents: number | null
  applicationId: string
  sandbox: boolean
  locations: { id: string; name: string }[]
  defaultOpen?: boolean
  canMessageCustomer: boolean
}

export function TakePayment({ jobId, balanceCents, applicationId, sandbox, locations, defaultOpen, canMessageCustomer }: Props) {
  const [open, setOpen] = useState(!!defaultOpen && locations.length > 0)
  const [tab, setTab] = useState<'card' | 'link'>('card')
  const [amount, setAmount] = useState(balanceCents && balanceCents > 0 ? (balanceCents / 100).toFixed(2) : '')
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [cardState, setCardState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const cardRef = useRef<SquareCard | null>(null)
  const idempotencyKey = useRef<string>('')

  useEffect(() => {
    if (open) {
      idempotencyKey.current = crypto.randomUUID()
      setError(null)
      setLinkUrl(null)
    }
  }, [open])

  useEffect(() => {
    if (!container || !locationId || tab !== 'card') return
    let cancelled = false
    let card: SquareCard | null = null
    setCardState('loading')
    loadSquareJs(sandbox)
      .then(async () => {
        if (cancelled || !window.Square) return
        card = await window.Square.payments(applicationId, locationId).card()
        if (cancelled) return void card.destroy()
        await card.attach(container)
        cardRef.current = card
        setCardState('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setCardState('error')
        setError(e instanceof Error ? e.message : 'Could not load the Square card form')
      })
    return () => {
      cancelled = true
      cardRef.current = null
      card?.destroy()
    }
  }, [container, locationId, tab, applicationId, sandbox])

  const amountCents = toCents(amount)
  const amountValid = Number.isInteger(amountCents) && amountCents >= 100

  function charge() {
    setError(null)
    startTransition(async () => {
      const card = cardRef.current
      if (!card) return setError('Card form is still loading')
      const tokenResult = await card.tokenize()
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        return setError(tokenResult.errors?.[0]?.message ?? 'Check the card details')
      }
      const result = await chargeJobCard({
        jobId,
        amountCents,
        locationId,
        idempotencyKey: idempotencyKey.current,
        sourceId: tokenResult.token,
      })
      idempotencyKey.current = crypto.randomUUID()
      if (!result.ok) return setError(result.message)
      toast.success(result.message, {
        action: result.receiptUrl ? { label: 'Receipt', onClick: () => window.open(result.receiptUrl!, '_blank') } : undefined,
      })
      setOpen(false)
    })
  }

  function makeLink(send: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await createJobPaymentLink({ jobId, amountCents, locationId, idempotencyKey: idempotencyKey.current, send })
      idempotencyKey.current = crypto.randomUUID()
      if (!result.ok) return setError(result.message)
      setLinkUrl(result.url ?? null)
      toast.success(result.message)
    })
  }

  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Square isn&apos;t ready to take payments — no active location with card processing was found.
      </p>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
        <CreditCard aria-hidden="true" />
        Take payment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Charged through Square{sandbox ? ' (sandbox)' : ''}. Payments are recorded on this job automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-amount">Amount (USD)</Label>
            <Input
              id="pay-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-invalid={amount !== '' && !amountValid}
              className="font-mono"
            />
            {balanceCents != null && (
              <button
                type="button"
                className="w-fit text-xs text-muted-foreground underline underline-offset-4"
                onClick={() => setAmount((balanceCents / 100).toFixed(2))}
              >
                Full balance ${(balanceCents / 100).toFixed(2)}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-location">Square location</Label>
            <NativeSelect id="pay-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'card' | 'link')}>
          <TabsList className="w-full">
            <TabsTrigger value="card">
              <CreditCard aria-hidden="true" />
              Enter card
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 aria-hidden="true" />
              Pay link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="flex flex-col gap-3 pt-2">
            <div className="relative min-h-24">
              <div ref={setContainer} />
              {cardState === 'loading' && (
                <p className="absolute inset-0 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading secure card form…
                </p>
              )}
            </div>
            <Button onClick={charge} disabled={pending || !amountValid || cardState !== 'ready'} className="h-10">
              {pending ? 'Charging…' : amountValid ? `Charge $${(amountCents / 100).toFixed(2)}` : 'Enter an amount'}
            </Button>
          </TabsContent>

          <TabsContent value="link" className="flex flex-col gap-3 pt-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sends the customer a Square checkout link by text and email. The payment shows up on this job after it syncs.
            </p>
            {linkUrl ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{linkUrl}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(linkUrl).then(() => toast.success('Link copied'))}
                >
                  <Copy aria-hidden="true" />
                  Copy
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => makeLink(true)}
                  disabled={pending || !amountValid || !canMessageCustomer}
                >
                  {pending ? 'Working…' : 'Send to customer'}
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => makeLink(false)} disabled={pending || !amountValid}>
                  Just create link
                </Button>
              </div>
            )}
            {!canMessageCustomer && (
              <p className="text-xs text-muted-foreground">Customer has no phone or email on file — create the link and share it yourself.</p>
            )}
          </TabsContent>
        </Tabs>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RefreshPaymentsButton({ jobId }: { jobId: number }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await refreshJobPayments(jobId)
          ;(r.ok ? toast.success : toast.error)(r.message)
        })
      }
    >
      <RefreshCw className={pending ? 'animate-spin' : undefined} aria-hidden="true" />
      Check for payment
    </Button>
  )
}
