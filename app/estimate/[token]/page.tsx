import Image from 'next/image'
import { notFound } from 'next/navigation'
import { EstimateResponse } from '@/components/estimates/estimate-response'
import { getEstimateByToken, getEstimateItems } from '@/lib/estimates'
import { findOperation } from '@/lib/operations'
import { getAllOperations } from '@/lib/operations-server'
import { BUSINESS_ADDRESS, BUSINESS_NAME, BUSINESS_PHONE } from '@/lib/notify'
import { formatDateLong, formatMoney, todayLocal } from '@/lib/time'

export const metadata = { title: 'Your estimate', robots: { index: false, follow: false } }

export default async function PublicEstimatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = await getEstimateByToken(token)
  if (!row) notFound()
  const { estimate, customer } = row
  const [items, operations] = await Promise.all([getEstimateItems(estimate.id), getAllOperations()])
  const op = findOperation(operations, estimate.operation)
  const expired = !!estimate.validUntil && estimate.validUntil < todayLocal()
  const answered = !(estimate.status === 'draft' || estimate.status === 'sent')
  const address = estimate.address || customer.address

  return (
    <main className="min-h-svh bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <Image src="/images/logo.jpg" alt={BUSINESS_NAME} width={60} height={80} className="h-20 w-15 rounded" />
          <div className="flex flex-col">
            <span className="font-semibold">{BUSINESS_NAME}</span>
            <span className="text-sm text-muted-foreground">
              {BUSINESS_ADDRESS} ·{' '}
              <a href={`tel:${BUSINESS_PHONE}`} className="underline underline-offset-4">
                {BUSINESS_PHONE}
              </a>
            </span>
          </div>
        </header>

        <section className="flex flex-col gap-5 rounded-xl border bg-card p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {op.singular} estimate #{estimate.id}
            </span>
            <h1 className="text-2xl font-bold text-balance">{estimate.title}</h1>
            <p className="text-muted-foreground">Prepared for {customer.name}</p>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {address && (
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Job address</dt>
                <dd className="font-medium">{address}</dd>
              </div>
            )}
            {estimate.validUntil && (
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Valid until</dt>
                <dd className="font-medium">{formatDateLong(estimate.validUntil)}</dd>
              </div>
            )}
          </dl>

          {estimate.description && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Scope of work</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed">{estimate.description}</p>
            </div>
          )}

          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Materials</h2>
              <ul className="flex flex-col divide-y rounded-lg border text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>{i.name}</span>
                    <span className="flex items-center gap-4 tabular-nums">
                      <span className="text-muted-foreground">
                        {Number(i.quantity)} {i.unit}
                      </span>
                      <span className="w-20 text-right">{formatMoney(Math.round(Number(i.quantity) * i.unitPriceCents))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="font-semibold">Estimate total</span>
            <span className="font-mono text-2xl font-bold tabular-nums">{formatMoney(estimate.priceCents)}</span>
          </div>
        </section>

        <EstimateResponse
          token={token}
          status={estimate.status}
          answered={answered}
          expired={expired}
          approvedByName={estimate.approvedByName}
          defaultName={customer.name}
          phone={BUSINESS_PHONE}
        />
      </div>
    </main>
  )
}
