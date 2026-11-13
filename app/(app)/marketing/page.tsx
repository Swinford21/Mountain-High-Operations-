import { desc } from 'drizzle-orm'
import { PageBody, PageHeader } from '@/components/page-header'
import { CampaignComposer } from '@/components/marketing/campaign-composer'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { getAudienceCounts, getAudiences } from '@/lib/marketing'
import { requireAdmin } from '@/lib/session'
import { formatTimestamp } from '@/lib/time'

export const metadata = { title: 'Marketing' }
export const maxDuration = 300

const CHANNEL_LABEL: Record<string, string> = { email: 'Email', sms: 'Text', both: 'Email + text' }

export default async function MarketingPage() {
  await requireAdmin()
  const audiences = await getAudiences()
  const [counts, history] = await Promise.all([
    getAudienceCounts(audiences),
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(30),
  ])

  return (
    <>
      <PageHeader
        eyebrow="Outreach"
        title="Marketing"
        description="Email and text your customers. Only customers who haven't opted out are included."
      />
      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <CampaignComposer audiences={audiences} counts={counts} />
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Sent campaigns</h2>
            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nothing sent yet.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-xl border bg-card">
                {history.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {audiences.find((a) => a.id === c.audience)?.label ?? c.audience}
                    </span>
                    <span className="text-sm">
                      {c.status === 'sent' ? (
                        <>
                          {c.recipientsCount} delivered
                          {c.failedCount > 0 && <span className="text-destructive"> · {c.failedCount} failed</span>}
                          <span className="text-muted-foreground"> · {formatTimestamp(c.sentAt)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sending…</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PageBody>
    </>
  )
}
